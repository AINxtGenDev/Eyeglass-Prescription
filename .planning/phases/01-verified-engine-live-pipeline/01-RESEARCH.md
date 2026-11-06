# Phase 1: Verified Engine & Live Pipeline - Research

**Researched:** 2026-11-06
**Domain:** Pure-JS ophthalmic optics engine (sphero-cylindrical meniscus lens geometry), its validation, a minimal German (de-AT) static page, and a gated GitHub Actions → GitHub Pages pipeline
**Confidence:** HIGH for engine math, fixtures and toolchain (verified this session by prototype runs and live registry and API queries). MEDIUM for Vogel's rule provenance, TABO wording and torus formation (secondary sources). LOW for the frame-shape parameters and the phone performance estimate.

> No CONTEXT.md exists; the user chose to plan from research plus requirements. The authoritative inputs are `./CLAUDE.md` (project rules), `.planning/research/SUMMARY.md` → *User Overrides* and *Resolved Conflicts*, `ROADMAP.md` Phase 1, and `REQUIREMENTS.md`. This file does not repeat what `.planning/research/*.md` already settles. It adds the concrete formulas, fixtures, oracle, catalogue, CI shape and validation map, and it corrects or sharpens earlier research where this session's evidence disagrees (marked **NEW** or **CORRECTION**).

## Summary

Everything the phase needs was checked this session with runnable prototypes in the scratchpad (not shipped code). The engine design holds up numerically:

- **Thick-lens design plus true-torus back surface** reproduces the prescription through an independent Snell's-law ray trace. The worst power-matrix error is **0.0015 D**, with zero axis error, over the full input range including +12/−6 and −12/−6, at n 1.50 and 1.738. A fast-check property over 300 random Rx/material/CT cases stayed below 0.01 D. The same oracle **fails a thin-lens design by 0.64 D**, so the oracle can discriminate.
- **All 143 rows** of three Zeiss CR-39 *spherical* fact sheets (65/70/75 mm, Version 6/23) reproduce well inside the ±0.20 mm tolerance Zeiss states on its sheets:
  - Edge-thickness geometry: worst 0.069 mm.
  - Labelled power through the thick-lens back-vertex-power (BVP) formula and the 1.530 tool-index conversion: worst 0.023 D.
  - End-to-end CT/ET solve: worst 0.081 mm.
  - A thin-lens solver **fails** the same rows (CT off by 0.375 mm at +4.00/75 mm). These rows are therefore a real ENG-08 tier-2 fixture, not a formality.

The toolchain claims were verified in a throwaway scaffold: Vite 8.3.6 `base`, Vitest 5.1.0 projects plus coverage thresholds (failing exit 1), ESLint 10 flat-config boundary rule, and a Playwright 1.65 smoke test against `vite preview` at `/Eyeglass-Prescription/`. Two sharp edges surfaced:

1. **Flat-config `globals` merge across matching blocks.** If browser globals are enabled for `src/**`, `fetch` and `HTMLElement` silently pass lint inside `src/engine/` (verified). Browser globals must be scoped to `src/ui/**` only.
2. **In the Cartesian sign convention, a meniscus back surface has positive geometric curvature `c2 = −D2/(1000(n−1))`.** Using `+D2/K` flips the back surface and produced ETs off by 26 mm in the first prototype run. This is the #1 sign bug for lens-critic to check.

The one real conflict is between **MAT-02 and Success Criterion 4**. With Vogel clamped to +10 D (MAT-02), "+12 in 62×55" at DBL 18 / PD 32 is *computable* (CT 26 mm, blank 89 mm). It is mathematically impossible only at DBL 24 / PD 25 (front radius 50 mm < 56 mm needed). The planner must pin the SC-4 acceptance case with full parameters (see Open Question 1).

**Primary recommendation:** Build a walking skeleton first: Vite + a sphere-only engine + a German page + CI + Pages enable + a live check, pushed only after user approval. Then deepen the engine behind the frozen `LensResult` contract. Use `conventions.js` (Cartesian, `c = −D/K` for the back), the thick-lens fixed point, the stable "tyre" torus formula, and four test tiers: analytic, the Zeiss CR-39 spherical rows, the Snell ray-trace oracle, and fast-check properties.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEPL-01 | Public site at `/Eyeglass-Prescription/`, no missing assets | §CI Workflow (deploy + `verify-live` job); Vite `base` verified; Playwright smoke with 4xx/requestfailed listener verified |
| DEPL-02 | push → lint → unit → build → browser smoke; failure blocks deploy | §CI Workflow (`deploy` `needs: build`, all gates in `build`); evidence plan in Validation Architecture |
| DEPL-03 | Engine cannot import three/DOM, enforced in CI | §ESLint boundary config (verified: `three`, `three/addons/*`, `document`, `window`, `fetch`, `HTMLElement` all error) plus the ESLint-API negative test |
| DEPL-04 | Actions SHA-pinned, npm exact | SHAs re-resolved 2026-11-06 (table); `.npmrc save-exact=true`; pin-audit test |
| ENG-01 | D(θ) = S + C·sin²(θ−α), TABO, one convention module | §Conventions; power-matrix form verified by the oracle |
| ENG-02 | Each surface its own power; thick-lens BVP within 0.01 D | §Thick-lens design; oracle 0.0015 D worst; property test |
| ENG-03 | True torus, axis-oriented, stable near plano and singularity | §Stable tyre-torus formula (verified exact on principal meridians, cancellation-free at c→0) |
| ENG-04 | CT from min-CT/min-ET over the real outline, mixed meridians | §CT solve (affine in CT + thick fixed point; ≤8 iterations even at +12/62×55) |
| ENG-05 | dec = (A+DBL)/2 − PD nasal; fitting height; asymmetric edges; per-eye, not mirrored | §Conventions (nasalSign), §Frame outlines (mirror the shape only) |
| ENG-06 | CT, ET max/min + location, t(x,y), volume, weight, protrusion, intermediates | §Metrics; ring quadrature −0.002 % vs closed form at 24×128 |
| ENG-07 | Coded impossible-lens diagnostic + German explanation + suggestion | §Diagnostic catalogue; verified impossible cases |
| ENG-08 | Tiered tests: analytic, chart ±0.20 mm after tool-index conversion, ray-trace oracle, properties | §Test tiers; Appendix A fixture rows |
| ENG-09 | Both lenses within one frame on a real mid-range phone, recorded | §Performance (desktop 0.87 ms/lens toric 48×256); in-page timing readout plus a human checkpoint |
| MAT-01 | Material ne, density, Abbe with sources in code | §Materials table (all values re-read from Zeiss PDFs this session) |
| MAT-02 | Auto base curve: documented, sourced, clamped | §Base curve (Vogel + clamp [+0.50, +10.00]); Open Question 1 |
| RX-02 | Comma/point, U+2212, `+`, `dpt`/`D`, `°`, `plan/pl/plano`; echo de-AT | §Parser spec + test table; Intl behaviour verified on Node 22.17 / ICU 77.1 |
| RX-03 | Plus-cyl transposed, both forms shown | §Transposition |
| FRAME-01 | Rund/Rechteckig/Panto/Pilot parametric outlines to A×B | §Frame outlines (superellipse family, exact bbox normalisation, star-shape test) |
| L10N-01 | `lang="de-AT"`, `Intl.NumberFormat("de-AT")`, minus and −0 handling | §Formatting (verified: `signDisplay:"exceptZero"` for powers, `"negative"` for mm/g) |
| L10N-02 | One dictionary keyed by message codes | §i18n; catalogue-completeness test |
| RES-06 | Persistent disclaimer naming simplifications | §Disclaimer content |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Project `./CLAUDE.md` rules (authoritative; they override generated sections) and the user's global `~/.claude/CLAUDE.md`:

- **UI German (de-AT) only.** The dictionary file is `src/i18n/de-AT.js`, **not** `en.js`. STACK.md's `en.js` and "fallback to English" are overridden: a missing key throws in dev/test, and in prod it shows the key.
- **Engine first, pure JS:** `src/engine/` has no Three.js and no DOM, and it is the single source of truth for every number. ARCHITECTURE.md's `src/domain/` path is **overridden** by `src/engine/` (SUMMARY Resolved Conflicts).
- **Accurate refraction = CPU ray-traced warp grid reusing engine surfaces** (phase 4). The phase-1 ray tracer is the oracle that phase 4 reuses, so it must live in `src/engine/trace.js`, not in test-only code.
- **GitHub Pages enablement (Source: GitHub Actions) is pre-authorized** once phase 1 is ready. **Every other outward-facing action still needs approval.** That includes `git push` to `origin` (which triggers a public deploy). The plan must contain a `checkpoint:human-verify` / approval gate before the first push and must not assume pushes are pre-approved. *(Global CLAUDE.md: "Ask first for … anything leaving the machine. Approval for one action does not carry to the next.")*
- **`lens-critic` gate:** it reviews the plan before execution and the result after; done = PASS or the user accepts the findings.
- **Out of v1:** ADD and prism are not modelled (explained in phase 2).
- **`references/` is git-ignored and must never be published.** The Vite build must not copy it: keep it outside `public/`, and never import from it.
- **`gsd-sdk` is not installed.** Use `node ~/.claude/get-shit-done/bin/gsd-tools.cjs <cmd>`.
- **Pinned exact versions**, minimal tooling (Vite). Every formula and constant must be traceable to a cited source.
- Global: verify before asserting; report real output; give a rollback path before production changes; atomic commits; no documentation files unless requested (RESEARCH/PLAN artifacts are part of GSD and so allowed).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Optics math (power, surfaces, CT solve, metrics, diagnostics codes, ray trace) | Browser / Client, `src/engine/` pure module | Node (Vitest) for tests | Static site, no backend; the engine must run identically in Node tests and the browser |
| Frame outlines (shapes → A×B polygon) | `src/engine/frame/` | — | CT/ET are defined on the outline; they must be testable with the engine |
| Material constants with citations | `src/engine/materials.js` | — | Numbers users act on; must sit inside the lint-guarded trust boundary |
| Input parsing / transposition / validation codes | `src/state/` (pure, DOM-free) | — | Pure functions tested in Node; produce codes, not German text |
| German text, number formatting | `src/i18n/` (`de-AT.js`, `t()`, `format.js`) | `src/ui/` | Codes → strings; Intl formatting is display-only |
| DOM form, result table, disclaimer, timing readout | `src/ui/` (browser globals allowed here only) | — | The only tier that touches `document` |
| Build, base path, asset hashing | Vite (build time) | — | `base: '/Eyeglass-Prescription/'` |
| Hosting / CDN | GitHub Pages (static) | — | Actions artifact deploy |
| Gating (lint/test/build/smoke) | GitHub Actions `build` job | `verify-live` job | A failure means no artifact, so no deploy |

## Standard Stack

### Core (Phase 1 installs; three.js is NOT needed until Phase 3)

| Library | Version (exact) | Purpose | Why Standard |
|---------|-----------------|---------|--------------|
| vite | 8.3.6 | Dev server, build with `base` | Verified `npm view` 2026-11-06; engines `^20.19.0 \|\| >=22.12.0`; base rewriting verified in scaffold (`/Eyeglass-Prescription/assets/index-*.js`) [VERIFIED: npm registry + scaffold build] |
| vitest | 5.1.0 | Unit/property tests (node env), coverage thresholds | engines `^22.12 \|\| ^24 \|\| >=26`; `test.projects` in `vite.config.js` works; threshold failure → exit 1 (verified) [VERIFIED: npm registry + scaffold run] |
| @vitest/coverage-v8 | 5.1.0 | Engine coverage gate | Must equal the vitest version [VERIFIED: npm registry] |
| fast-check | 4.10.2 | Property tests (BVP round trip, symmetry, monotonicity) | Verified working with vitest 5 in scaffold (300 runs, seed 42) [VERIFIED: npm registry + scaffold run] |
| eslint | 10.14.0 | Lint + engine boundary | Flat config; `no-restricted-imports` / `no-restricted-globals` verified [VERIFIED] |
| @eslint/js | 10.0.1 | `js.configs.recommended` | [VERIFIED: npm registry] |
| globals | 17.14.0 | Browser globals for `src/ui/**` only; node for config/tests | [VERIFIED: npm registry] |
| @playwright/test | 1.65.0 | Smoke test vs `vite preview` and vs the live URL | Verified smoke at sub-path; needs `npx playwright install --with-deps chromium` (CI) [VERIFIED] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| prettier | 3.9.10 | Formatting | Optional in phase 1 (`format:check` step) |
| eslint-config-prettier | 10.1.8 | Disable stylistic lint rules | Only if prettier is adopted |
| @axe-core/playwright | 4.14.0 | Automated a11y check | Optional in phase 1 (UX-04 is phase 2); a single axe pass on the minimal page is cheap and recommended |

**Not in phase 1:** `three` (phase 3), `vite-plugin-pwa` (phase 4), `@preact/signals-core` (only if needed), `typescript` (optional checkJs).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest `bench` as perf gate | Plain informational timing | CI runners vary; ENG-09 is defined on a real phone, so CI timing must not gate. Use bench/log only |
| Golden-section refinement of the outline extremum | Dense 720-point outline + convergence test (720 vs 5760 ≤ 0.005 mm) | Simpler, deterministic; discrete-max error with about 0.25 mm spacing is negligible (curvature-limited) |
| Hand-written ESLint plugin for the boundary | Built-in `no-restricted-imports` + `no-restricted-globals` + scoped `globals` | Built-ins suffice (verified) |

**Installation:**
```bash
npm install -D --save-exact vite@8.3.6 vitest@5.1.0 @vitest/coverage-v8@5.1.0 fast-check@4.10.2 \
  eslint@10.14.0 @eslint/js@10.0.1 globals@17.14.0 @playwright/test@1.65.0
# optional in phase 1: prettier@3.9.10 eslint-config-prettier@10.1.8 @axe-core/playwright@4.14.0
echo "save-exact=true" > .npmrc
echo "22" > .nvmrc
```

**Version verification (run 2026-11-06):** `npm view <pkg> version` returned exactly the versions above. None has a `postinstall` script (`npm view <pkg> scripts.postinstall` was empty for all). Local Node v22.17.0, npm 11.6.0.

## Package Legitimacy Audit

slopcheck was run with `-e npm` and bare names; with `name@version` it misreports every package as SLOP, and auto-detection picks PyPI, so always pass `-e npm`.

| Package | Registry | Age | Downloads (wk) | Source Repo | slopcheck | Disposition |
|---------|----------|-----|----------------|-------------|-----------|-------------|
| vite | npm | 6+ yrs | 254.6M | github.com/vitejs/vite | [OK] | Approved |
| vitest | npm | since 2021-12-03 | 175.2M | github.com/vitest-dev/vitest | [SUS] (name resembles "vite"; false positive) | Approved: repo, maintainers (antfu, yyx990803, …) and downloads verified |
| @vitest/coverage-v8 | npm | — | — | vitest-dev/vitest | [OK] | Approved |
| fast-check | npm | 7+ yrs | 77.2M | github.com/dubzzz/fast-check | [OK] ("fast-" name heuristic, "package is established") | Approved |
| eslint | npm | 10+ yrs | 203.9M | github.com/eslint/eslint | [OK] | Approved |
| @eslint/js | npm | — | — | eslint/eslint | [OK] | Approved |
| globals | npm | — | — | sindresorhus/globals [ASSUMED repo] | [OK] | Approved |
| @playwright/test | npm | — | 107.8M | github.com/microsoft/playwright | [OK] | Approved |
| @axe-core/playwright | npm | — | 22.3M | github.com/dequelabs/axe-core-npm | [OK] | Approved (optional) |
| prettier | npm | — | — | prettier/prettier [ASSUMED repo] | [OK] | Approved (optional) |
| eslint-config-prettier | npm | — | — | — | [OK] | Approved (optional) |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `vitest`. This is a false positive on name similarity, cleared by repo/maintainer/download evidence above. No checkpoint is needed beyond normal review.
**npm audit (scaffold):** 4 *moderate* findings, all `minimatch` (GHSA-g3hv-75wg-m249, ReDoS-class) reached via `eslint@10` → `@eslint/config-array`. These are dev-only and never shipped. The "fix" downgrades to eslint 9. **Do not** add `npm audit` as a failing CI gate at moderate level. If you audit at all, use `npm audit --omit=dev --audit-level=high`.

## Architecture Patterns

### System Architecture Diagram

```
 user types (DOM, src/ui)                      push to main (git)
        │ raw strings "-2,25" "+1 dpt" "x180"          │
        ▼                                              ▼
 ┌──────────────── src/state (pure) ────────┐   ┌──── GitHub Actions: build job ───────────────┐
 │ parse (codes) → transpose(+cyl→−cyl)     │   │ npm ci → lint (incl. engine boundary)         │
 │ → LensSpec[OD], LensSpec[OS]              │   │ → vitest --coverage (tiers 1-4)               │
 └───────────────┬──────────────────────────┘   │ → vite build (base) → playwright smoke        │
                 ▼                              │   vs vite preview at /Eyeglass-Prescription/  │
 ┌──────────────── src/engine (pure) ───────┐   │ → upload-pages-artifact (main only)           │
 │ frame/outline(shape,A,B,eye) ─┐          │   └──────────────┬────────────────────────────────┘
 │ materials(id) ──► baseCurve() ─┤          │                  │ needs: build (any failure ⇒ stop)
 │ conventions (signs, TABO, nasal)          │                  ▼
 │ design(): thick-lens fixed point ◄─────┐  │   ┌──── deploy job (pages:write, id-token) ─┐
 │   D1v → c_a,c_b → outline max d → CT ──┘  │   │ deploy-pages → github-pages env         │
 │ field/metrics: CT, ET extremes, volume,  │   └──────────────┬──────────────────────────┘
 │   weight, protrusion, intermediates      │                  ▼
 │ diagnostics: {code, severity, data}      │   ┌──── verify-live job ────────────────────┐
 │ trace.js: Snell ray trace (oracle; reused │   │ poll live URL for commit hash → smoke   │
 │   by phase-4 warp grid)                  │   │ vs https://ainxtgendev.github.io/…/     │
 └───────────────┬──────────────────────────┘   └──────────────────────────────────────────┘
                 ▼ LensResult ×2 (frozen contract)
 ┌──────── src/i18n + src/ui ───────────────┐
 │ t(code) German text; format.js (de-AT);  │
 │ result table per eye; diagnostics;       │
 │ disclaimer; timing readout; build hash   │
 └──────────────────────────────────────────┘
```

### Recommended Project Structure

```
index.html                 # lang="de-AT", disclaimer markup slot, <script type=module src=./src/ui/main.js>
vite.config.js             # base + test.projects + coverage thresholds
eslint.config.js           # boundary rules (see below)
playwright.config.js       # baseURL from env BASE_URL, else vite preview
.nvmrc (22)  .npmrc (save-exact=true)  package.json (exact versions, "engines": {"node": ">=22.12"})
.github/workflows/deploy.yml
src/
├── engine/                # NO three, NO DOM (lint-enforced). Single source of numbers.
│   ├── conventions.js     # frame, signs, TABO, nasalSign, units, written once, heavily commented
│   ├── power.js           # meridianPower, powerMatrix, sphericalEquivalent, baseCurveAuto (Vogel+clamp)
│   ├── sag.js             # sphereSag (stable), torusSag (stable tyre), gradients, domain guards
│   ├── design.js          # thick-lens fixed point → surfaces {c1, ca, cb, axisRad, ct}
│   ├── solve.js           # CT over outline; binding constraint
│   ├── metrics.js         # ET extremes + location labels, thicknessAt, ring-grid volume, weight, protrusion
│   ├── trace.js           # ray–surface intersection (Newton), vector Snell, traceBVP(), matrixToRx()
│   ├── diagnostics.js     # code catalogue (frozen object), severity
│   ├── materials.js       # 5 rows, each with ne, nd, νe, νd, density, minCT/minET defaults, source
│   ├── evaluate.js        # public API: evaluateLens(spec, outline) → LensResult; evaluatePair()
│   └── frame/{shapes.js,outline.js}
├── state/                 # pure, DOM-free (node-tested)
│   ├── parse.js           # parseDiopter, parseAxis, parsePD → {ok,value}|{ok:false,code}
│   └── transpose.js       # plus-cyl → minus-cyl
├── i18n/
│   ├── de-AT.js           # flat dictionary keyed by codes
│   ├── t.js               # t(key, params), throws on missing key in dev/test
│   └── format.js          # fmtDiopter, fmtAxis, fmtMm, fmtGram (Intl de-AT)
└── ui/                    # browser globals allowed ONLY here
    └── main.js, form.js, result.js
test/
├── fixtures/zeiss-fsv-6-23-cr39-spherical.json   # Appendix A rows + provenance
└── e2e/smoke.spec.js                             # Playwright
```
Co-locate unit tests as `src/**/*.test.js` (Vitest project `unit`, environment `node`).

### Pattern 1: Conventions module (ENG-01, ENG-05), one file and no exceptions

```js
// src/engine/conventions.js — the ONLY place signs/frames are defined.
// Units: mm, dioptres (1/m). K(n) = 1000·(n − 1)  [mm·D]
// Lens-local frame (examiner facing the wearer): origin = boxing centre of that lens,
//   +x = examiner's right (= wearer's LEFT), +y = up, +z = toward examiner / object side.
//   Light travels −z (object → eye). Right-handed; CCW is seen from +z (the examiner).
// TABO (ISO 8429): axis angle CCW from +x, IDENTICAL for OD and OS, engine range [0, 180).
//   Input 180 ≡ 0; display 0 as 180 (prescription convention). [CITED: GB/T 40177-2021 = ISO 8429:1986]
// Nasal direction: OD nasal = +x, OS nasal = −x  → nasalSign = eye === 'OD' ? +1 : −1
// Optical centre: oc = { x: nasalSign · ((A + DBL)/2 − monoPD), y: fittingHeight == null ? 0 : fittingHeight − B/2 }
// Surfaces (sags positive toward the eye; ρ measured from oc):
//   zFront(x,y) = −sF(ρ)            sF uses c1 = +D1 / K          (convex front ⇒ c1 > 0)
//   zBack(x,y)  = −CT − sB(x,y)     sB uses c = −D2 / K per principal meridian
//                                   (Cartesian: D2 = (1 − n)/R2; concave meniscus back ⇒ D2 < 0 ⇒ c > 0)
//   thickness t(x,y) = CT − sF + sB
export const K = (n) => 1000 * (n - 1);
export const nasalSign = (eye) => (eye === 'OD' ? 1 : -1);
```
**Why the back sign matters (NEW, verified):** the first prototype used `c2 = +D2/K`. Every Zeiss edge thickness came out negative (e.g. −9.17 mm instead of 1.1 mm). With `c2 = −D2/K`, all 143 rows agree within 0.069 mm. Add an invariant test: a minus lens has ET > CT, and a plus lens has ET < CT.

### Pattern 2: Thick-lens design with CT fixed point (ENG-02, ENG-04)

The Rx is a back-vertex power. The front is spherical (scalar), so the BVP *matrix* is `D1v·I + D2-matrix` with
`D1v = D1 / (1 − (CT/1000)/n · D1)`, which gives principal back powers:
- along the cylinder axis: `D2a = S − D1v`
- perpendicular to the axis: `D2b = S + C − D1v` (C ≤ 0, so this one is steeper)

Thickness is affine in CT: `t = CT − d(x,y)`, with `d = sF − sB`. So for fixed surfaces:
`CT = max(minCT, minET + max_i d(p_i − oc))` over the outline points `p_i`.

Because D2 depends on CT, iterate: CT₀ = minCT, then design(CT) → outline max d → CT′, until |ΔCT| < 1e-4 mm. Cap at 50 iterations and emit `THICK_LENS_NOT_CONVERGED`. Before each step, guard `1 − (CT/1000)/n·D1 > 0`, else emit `VERTEX_TERM_INVALID`.

Observed: 0 iterations for minus lenses (CT = minCT immediately), 5–8 iterations for +6…+12. Iterate **only on the outline**; evaluate the interior grid once afterwards (ARCHITECTURE.md benchmark: 30× cheaper).

```js
// Verified in scratch prototype (proto/engine.mjs, proto/ctsolve.mjs)
export function design({ sph, cyl, axisDeg, n, D1, ct }) {
  const k = 1000 * (n - 1), t = ct / 1000;
  const D1v = D1 / (1 - (t / n) * D1);            // front contribution at the back vertex
  const D2a = sph - D1v, D2b = sph + cyl - D1v;    // a: along axis, b: ⟂ axis
  return { n, ct, c1: D1 / k, ca: -D2a / k, cb: -D2b / k, ax: axisDeg * Math.PI / 180 };
}
```

### Pattern 3: Stable true-torus ("tyre") back surface (ENG-03), NEW

Rotate into axis coordinates relative to the OC: `u = x′cosα + y′sinα` (along the cylinder axis) and `v = −x′sinα + y′cosα`.

Tyre formation (the form used for mass-produced spectacle lenses): the generating circle is the steeper *cross curve* `c_b`, lying in the v–z plane. It is swept along u at the flatter *base-curve* radius `1/c_a` [CITED, secondary: slideshare/rajukaiti "Spherical, cylindrical and toric lenses"; brainscape terminology cards; base curve = flatter meridian per US patent 3960442 — MEDIUM].

The naive form `R_u − √((R_u − z_v)² − u²)` cancels catastrophically when `c_a → 0`. The algebraically identical stable form is:

```js
// sag of a sphere/conic, rationalised (never R − √(R² − r²)); NaN ⇒ domain violation (caller emits code)
export const sphereSag = (c, r2, k = 0) => { const q = 1 - (1 + k) * c * c * r2; return q < 0 ? NaN : c * r2 / (1 + Math.sqrt(q)); };
// Tyre torus: generating circle curvature cv (⟂ axis), sweep curvature cu (along axis). Stable for cu → 0.
export function torusSag(cu, cv, u, v) {
  const zv = sphereSag(cv, v * v);            if (Number.isNaN(zv)) return NaN;
  const den = 1 - cu * zv;                    if (den <= 0) return NaN;
  return zv + sphereSag(cu / den, u * u);     // ≡ R_u − √((R_u − zv)² − u²), but without cancellation
}
// Gradient (for ray-trace normals; phase-3 mesh normals reuse it):
//   q = cu/(1 − cu·zv), a = √(1 − q²u²), zv' = cv·v/√(1 − cv²v²)
//   ∂z/∂u = u·q/a,  ∂z/∂v = zv'/a      (rotate back by α to get ∂/∂x, ∂/∂y)
```
Verified: principal meridians are exactly the circle sags (error 0); stable equals naive to 3e-15 off-axis; at `cu = 0` it is the exact circular cylinder; `cu = 1e-12` is continuous.

**Important limitation (NEW):** the paraxial ray-trace oracle **cannot distinguish torus orientations** (tyre vs barrel), because both have the same vertex curvatures. Orientation only changes off-axis sag (0.10–0.39 mm at CYL −6, r 30 mm per PITFALLS Pitfall 5). Document the choice in `conventions.js`/`sag.js`. Keep the meridional model only as a test cross-check that reproduces the documented difference table.

### Pattern 4: Ray-trace oracle (ENG-08 tier 3; reused in phase 4), NEW, verified

`src/engine/trace.js`:
1. Launch parallel rays travelling −z from z = +10 on a ring of radius h = 0.25 mm (16 rays) about the OC.
2. Intersect the front surface by Newton on `h(s) = z_ray(s) − zFront(x(s), y(s))`, with `h′ = d_z − g_x d_x − g_y d_y`, until |Δs| < 1e-13. Refract (vector Snell, η = 1/n).
3. Intersect the back surface the same way and refract (η = n).
4. Propagate to the back-vertex plane z = −CT. Record position P and slope σ = (d_x, d_y)/(−d_z).
5. Least-squares fit σ = M·P and set the dioptric power matrix **F = −1000·M**, symmetrised.
6. Expected matrix (dioptric power matrix, consistent with ENG-01 since `eᵀFe = S + C·sin²(θ−α)`):
   `F = [[S + C·sin²α, −C·sinα·cosα], [−C·sinα·cosα, S + C·cos²α]]` [ASSUMED name/source (Harris/Keating power matrix); the formula's consistency with ENG-01 was verified algebraically and by the trace].
7. `matrixToRx(F)`: m = (F₁₁+F₂₂)/2, r = √(((F₁₁−F₂₂)/2)² + F₁₂²), S = m + r, C = −2r, α = ½·atan2(2F₁₂, F₁₁ − F₂₂) mod 180.

**Measured (this session):** worst element error 0.0015 D and 0.000° axis error for thick designs over the listed cases (including +12/−6×45 and −12/−6×10 at n 1.5/1.738). A fast-check property (300 runs, Sph −12…+12 and Cyl −6…0 in 0.25 steps, any axis, all 5 materials, CT 1–12 mm) stayed below 0.01 D. A thin-lens design (`D2 = D − D1`) fails at 0.64 D, so the oracle discriminates. The independence argument: the design uses the closed-form vertex relation, while the oracle uses Snell's law on the actual sag surfaces. A wrong torus *axis rotation sign* or a wrong D1v would both show up.

### Pattern 5: Codes, not strings (L10N-02)

Engine and parser return `{ code, severity, data }`. `src/i18n/de-AT.js` maps `diag.<CODE>.title|explain|suggest` and `parse.<CODE>`. A unit test iterates over `Object.keys(DIAGNOSTICS)` and the parse codes and asserts that every key exists in `de-AT.js`, plus the reverse check (no orphan keys).

### Anti-Patterns to Avoid

- **`c2 = D2/K` for the back surface:** wrong sign; see Pattern 1.
- **Browser globals for `src/**`:** they leak into the engine because flat-config globals merge (verified). Scope them to `src/ui/**`.
- **Iterating CT on the full grid:** iterate on the outline only.
- **Mirroring the left lens (`x → −x`) in the engine:** mirror only the frame *shape*. The Rx is evaluated in the shared examiner frame.
- **Clamping or `Math.max(0, …)` inside sqrt:** return NaN, then the caller emits a coded diagnostic.
- **Using Zeiss "Packaged Weight" as a weight fixture:** it includes packaging. Computed lens weight is 3.2–4.3 g lower on every checked row (NEW).
- **`page.goto('/')` in Playwright smoke:** use `page.goto('./')` and assert `page.url()` ends with `/Eyeglass-Prescription/`. On Pages, `/` is a different site.

## Engine Specification (concrete, per requirement)

### ENG-01 meridian power
`D(θ) = S + C·sin²(θ − α)`, with S in the axis meridian and S + C at α + 90°. Tests: D(α) = S, D(α+90) = S + C, period π, and equality with `eᵀFe`.

### MAT-02 base curve (auto)
Vogel's rule (form agreed across secondary sources): SE = S + C/2.
- SE > 0: `D1 = SE + 6.00`
- SE ≤ 0: `D1 = SE/2 + 6.00`

The two branches are continuous at 0. Worked examples: +4.00 −1.00 × 90 → 9.50 D; −4.00 −2.00 × 180 → 3.50 D [CITED: open-exam-prep.com ABO optics II; optiboard; slideshare base-curve decks. MEDIUM: no primary textbook accessed]. Use the worked examples as unit tests.

Then **clamp to [+0.50, +10.00] D**:
- The ceiling is the manual range in idea.md and REQUIREMENTS MAT-03.
- The floor is a project design choice, not a manufacturing limit. It was informed by Zeiss 1.74 −12.00 front 0.43 D @1.530 ≈ 0.60 D true and Zeiss CR-39 −8.00 front 1.50 D @1.530 [VERIFIED: Zeiss PDFs]. **Correction (2026-11-06, lens-critic iteration 2 m2):** the earlier wording "consistent with the flattest manufacturer fronts seen" is contradicted by ZEISS Finished SV SPH 1.53 (Trivex, doc Z00981.FS1, fsv2023.pdf p.79), whose −7.00 and −8.00 rows use a 0.15 D front @1.530 [VERIFIED: `pdftotext -f 79 -l 79` by the planner]. Flatter real fronts exist; the model simply does not go below +0.50, and user-facing texts say "in diesem Modell".
- Emit `BASE_CURVE_CLAMPED` (info) with `{vogel, used}`.
- **Superseded by D-01 (amended again 2026-11-06, see 01-02-PLAN context):** if the Vogel-clamped front is too steep for the frame (R1 < ρmax + 2 mm) or the lens fails (FRONT_/BACK_SAG_UNDEFINED), the engine searches [+0.50, +10.00] for the computable D1 with the smallest max(CT, etMax) and reports `BASE_CURVE_CLAMPED` reason `frame-optimised`; errors only if no D1 computes.
- Label it in Expert view (phase 2) as "Näherung (Vogel-Regel)".
- Vogel ignores the index; real high-index aspherics are far flatter (PITFALLS Pitfall 1). That belongs in the disclaimer's simplifications.

### ENG-05 decentration
`dec = (A + DBL)/2 − monoPD`, positive = nasal. The OC is always inside the outline horizontally within the input ranges: worst case A = 40, DBL = 24, PD = 25 gives dec = 7 mm < 20 mm. Still keep `OC_OUTSIDE_OUTLINE` for fitting-height inputs.

Per-eye tests:
- Sphere-only Rx gives OD/OS edge maps that are mirror images (nasal ↔ temporal), e.g. −6.00 in 52×40, PD 32: nasal 5.20 mm, temporal 7.44 mm for both eyes (prototype).
- An oblique-cyl Rx with the same axis on both eyes is **not** mirrored: the thickness maxima lie in the same screen direction.

### ENG-06 metrics (the `LensResult.metrics` contract)
- `ct`
- `etMax`/`etMin`: `{ value, index, location }`, where location ∈ {nasal, temporal, superior, inferior, nasal-superior, …} is derived from the outline point angle relative to the boxing centre using nasalSign.
- `etAt: { nasal, temporal, superior, inferior }`: outline points at the boxing extremes.
- `thicknessAt(x, y)`.
- `volumeMm3`: ring-grid triangle quadrature. 24×128 is already −0.002 % from the closed form. Closed form for a round lens centred on the OC: `∫₀ᵃ s dA = πa²R − (2π/3)(R³ − (R² − a²)^{3/2})`.
- `weightG = volumeMm3/1000 · density`.
- `frontProtrusion`: max and min of sF along the outline, i.e. how far the front vertex sits ahead of the edge front.
- `mbsMm = 2·max|p_i − oc| + 2`.
- Intermediates: D1, D1v, D2a, D2b, R1, Ra, Rb, sF/sB at the extremes, binding constraint (`'minCT' | 'minET'`), iterations, `baseCurveRule`.

### ENG-07 diagnostic catalogue (recommended)

| Code | Severity | Trigger | `ok` | German dictionary keys (title / explain / suggest) |
|---|---|---|---|---|
| `FRONT_SAG_UNDEFINED` | error | `1 − (1+k)c1²ρ² < 0` at some outline point | false | "Glas nicht herstellbar" / front sphere smaller than the lens at this frame size and position / smaller frame, higher index (verified: 1.74 makes the +12/62×55/DBL24/PD25 case computable) |
| `BACK_SAG_UNDEFINED` | error | torus domain fails (`1 − cb²v² < 0`, `1 − ca·zv ≤ 0`, or `1 − q²u² < 0`); data: meridian | false | as above, naming the steep meridian; suggestion: higher index, smaller/rounder frame |
| `VERTEX_TERM_INVALID` | error | `1 − (CT/1000)/n·D1 ≤ 0` | false | internal design limit |
| `THICK_LENS_NOT_CONVERGED` | error | > 50 iterations | false | internal |
| `NON_FINITE_RESULT` | error | any NaN/∞ in metrics (fuzz guard) | false | internal |
| `OC_OUTSIDE_OUTLINE` | warn | OC not inside the outline polygon | true | decentration too large |
| `BLANK_EXCEEDS_STOCK` | warn | `mbsMm > 75` (largest Zeiss stock blank on the sheets read) | true | larger blank / special order |
| `BASE_CURVE_CLAMPED` | info | Vogel outside [0.50, 10.00] (reason `range`), or the D-01 fallback search chose the front (reason `frame-optimised`, added 2026-11-06) | true | shows rule and value |
| `CT_SET_BY_MIN_ET` / `CT_SET_BY_MIN_CT` | info | binding constraint | true | (Expert, phase 2) |

Parser/state codes (not engine): `PARSE_EMPTY`, `PARSE_NOT_A_NUMBER`, `PARSE_MIXED_SEPARATORS`, `PARSE_TOO_MANY_DECIMALS`, `CYL_TRANSPOSED` (info), `AXIS_MISSING_FOR_CYL`.

Range and plausibility validation (RX-04/05) is phase 2. For phase 1, the parser plus a minimal "engine precondition" check (finite numbers) is enough.

### Impossible-lens behaviour, verified examples (for tests)

| Case (CR-39 unless noted; rectangular superellipse p=6 outline) | D1 used | Result |
|---|---|---|
| +12, 62×55, DBL 18, PD 32 | 10.00 (Vogel 18 clamped) | **computable**: CT 26.12 mm, MBS 89 mm (warn `BLANK_EXCEEDS_STOCK`) |
| +12, 62×55, DBL 24, PD 25 | 10.00 | **`FRONT_SAG_UNDEFINED`** (R1 50 mm < ρmax ≈ 56 mm) — superseded 2026-11-06 by D-01: now computable via the frame-optimised search (planner prototype D1 ≈ 6.69, CT ≈ 33.3 mm at p = 5) |
| same, n 1.738 | 10.00 | computable, CT 23.55 mm (so "higher index" is a truthful suggestion) |
| −12/−6 × 10, 62×55, DBL 18, PD 32 | 0.50 (Vogel −1 clamped) | **`BACK_SAG_UNDEFINED`** |
| same, n 1.738 | 0.50 | computable, CT 1.80 |
| +12 with *unclamped* Vogel D1 = 18 | 18 | `FRONT_SAG_UNDEFINED` (R1 27.8 mm) |

## ENG-08 Test Tiers

| Tier | What | Tolerance | Evidence this session |
|---|---|---|---|
| 1 Analytic | sphere sag closed form (e.g. c = 0.01, r² = 100 → 0.5012562893); torus principal meridians = circle sag; torus with `cu = cv` = sphere at any point; `cu = 0` = cylinder; plano → 0; round-lens volume vs closed form; D(θ) identities; transposition round trip; Vogel worked examples | 1e-9 mm / 1e-12 D (volume 0.01 %) | all verified in prototype |
| 2 Manufacturer chart | Zeiss CR-39 **spherical** rows (Appendix A, 143 rows): (a) ET from published CT + curves; (b) BVP from curves (tool-index → true via ne 1.500) = labelled power; (c) end-to-end solve with the sheet's front curve as manual D1 and the row's binding constraint | (a), (c) ±0.20 mm (Zeiss sheet tolerance); (b) ±0.05 D (curves are rounded to 0.01 D @1.53) | (a) worst 0.069 mm, (b) 0.023 D, (c) 0.081 mm; thin-lens fails (c) at 0.375 mm |
| 3 Ray-trace oracle | traced power matrix vs Rx; fast-check over the full input range | ≤ 0.01 D per element, axis ≤ 0.1° when \|C\| ≥ 0.25 | 0.0015 D worst |
| 4 Properties / invariants | minus ET > CT; plus ET < CT; CYL = 0 on round outline centred at OC → ET constant; OD/OS sphere-only mirror; OD/OS oblique-cyl not mirrored; higher n → thinner at the same constraints (minus ET, plus CT); \|S\| ↑ → minus ET ↑; axis sweep 0…179 in 1° steps → CT/ET continuous (no jump > 0.05 mm per °); outline 720 vs 5760 samples ≤ 0.005 mm; fuzz grid (S, C, α, n, shape, A, B, DBL, PD extremes) → either `ok` with finite numbers or an error code, **never NaN** | as stated | to be built |

**Tool-index conversion (fixture importer):**
- A curve published "in 1.530 index" defines a *radius*: `c = D₁.₅₃ / 530` [1/mm], independent of the true material.
- The true surface power is `D_true = D₁.₅₃ · (ne − 1)/0.530` [CITED: Zeiss FSV note "All curves are in 1.530 Index"].
- Back curves are printed **negative** on the CR-39 sheets used. Normalise with the Cartesian rule (concave back gives `c = +|D|/530`) and assert `front − |back|` ≈ F (± thick-lens offset). Other Zeiss sheets print the back as a positive magnitude (PITFALLS Pitfall 4).
- For (c), set the row constraint as follows: plus rows with ET equal to the sheet's minimum (1.0 mm at 65/70 mm, 1.1 mm at 75 mm) get `minET = ET_row`, `minCT = 1.6` (sheet note "No lens to be sold with a CT under 1.6mm"). The other rows get `minCT = CT_row`. Reason: the 75 mm +0.25…+1.00 rows (ET 1.7) and plano rows use row-specific thickness choices, so one per-sheet constraint mis-predicts them by 0.6 mm (verified).
- Aspheric 1.67/1.74 rows are **sanity only** (±0.7 mm, or excluded). Never tune constants to pass them.

## Materials (MAT-01), values re-read from the Zeiss PDFs this session

| id | Label (UI) | ne | nd | νe | νd | ρ g/cm³ | Default minCT (minus) | Default minET (plus) | Source (Zeiss, Version 6/23) |
|---|---|---|---|---|---|---|---|---|---|
| `cr39` | CR-39 1,50 | **1.500** | 1.499 | 56 | 58 | 1.32 | 1.8 | 1.0 | FSV `fsv2023.pdf`, "synchrony Finished SV SPH 1.5 HC 75/70/65mm" (doc 00523.FS1), doc p.124/132/140; CT 1.8 on all minus rows; plus ET 1.0 (65/70 mm) / 1.1 (75 mm) |
| `pc` | Polycarbonat 1,59 | 1.590 | 1.586 | 29 | 30 | 1.20 | 1.5 | 1.3 | FSV p.66/69 (PC spherical/HC+); minus CT 1.3–1.5 (UVProtect HART, p.62); HC+ plus ET 1.3; "No lens … CT under 1.1mm" |
| `idx160` | 1,60 | 1.598 | 1.595 | 40 | 41 | 1.30–1.31 | 1.2 | 1.1 | ClearView `clearview-lensspec.pdf` 1.6 sheets (pdf p.33–34): minus CT 1.2, plus ET 1.1 |
| `idx167` | 1,67 | 1.664 | 1.659 | 32 | 32 | 1.35 (FSV) / 1.36 (ClearView) | 1.2 | 1.0 [ASSUMED; Pitfalls 1.05 at +6] | FSV 1.67 sheets p.7–23 (minus CT 1.20) |
| `idx174` | 1,74 | 1.738 | 1.731 | 32 | 32.6 | 1.47 | 1.1 | 1.0 [ASSUMED] | FSV 1.74 sheet (pdf p.4–6): minus CT 1.10 |

**CORRECTION:** PITFALLS.md lists CR-39 ne 1.502. In the same Zeiss PDF, most 1.5 sheets (including all three spherical sheets used as fixtures) state **nd 1.499 / ne 1.500**, and some (PhotoFusion, BlueGuard) state 1.502. Use **1.500**: it matches the fixture sheets, and the BVP check closes to 0.023 D with it. Record both values in the source comment.

Source URLs: https://www.zeiss.com/content/dam/vis-b2b/usa/downloads/pdfs/fsv2023.pdf and …/clearview-lensspec.pdf. Note that **plain curl gets HTTP 403** from Akamai. Downloading needs a browser User-Agent, which matters if a test or script ever fetches them. Don't fetch at test time; commit transcribed values.

## Parser, Transposition, Formatting (RX-02, RX-03, L10N-01)

### `parseDiopter(raw)` → `{ ok: true, value } | { ok: false, code }`

Steps:
1. `trim`, then lower-case.
2. Map U+2212, U+2012, U+2013, U+2010, U+FE63 and U+FF0D to `-`.
3. Strip a trailing unit: `/\s*(dpt\.?|dioptrien|d)$/`.
4. `plan|pl|plano|±0|+-0` → 0.
5. Match `^([+-]?)(\d{1,2})(?:[.,](\d{1,2}))?$`; otherwise return `PARSE_MIXED_SEPARATORS` (if both `.` and `,` appear) or `PARSE_NOT_A_NUMBER`.
6. Build the value as `Number(sign + int + '.' + (frac ?? '0'))`. Never use `parseFloat`.

| Input | Value | Input | Value |
|---|---|---|---|
| `-2,25` | −2.25 | `−2.25` (U+2212) | −2.25 |
| `+1` | 1 | `1,5 dpt` | 1.5 |
| `-2.25 D` | −2.25 | `plan` / `pl` / `Plano` | 0 |
| `1.000,25` | error MIXED | `abc`, `` | error |
| `-2,255` | error TOO_MANY_DECIMALS | `2,25-` | error NOT_A_NUMBER (phase 2 may add "Meinten Sie −2,25?") |

`parseAxis(raw)`: strip a leading `x`/`×`/`@` and a trailing `°`, integer 0…180, 180 → 0 internally. `parsePD(raw)`: `32,5` → 32.5 (phase 2 adds `32/33` and binocular).

### `transpose({ sph, cyl, axis })` when cyl > 0

`S′ = S + C`, `C′ = −C`, `α′ = (α + 90) mod 180`. For display, show 0 as 180. Return `{ minus, plus, transposed: true }` so the UI shows both forms ("eingegeben: +1,00 / +2,00 × 90 → Minuszylinder: +3,00 / −2,00 × 180"). The range check after transposition is phase 2 (RX-04).

### Formatting (verified on Node 22.17, ICU 77.1)

- `new Intl.NumberFormat('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' })`:
  - −2.25 → `-2,25` (U+002D hyphen-minus), 2.25 → `+2,25`, 0 / −0 / −0.001 → `0,00`, −0.005 → `-0,01`.
  - `fmtDiopter` replaces `-` with U+2212 to echo `−2,25 dpt` (RX-02 example).
- Thickness/weight: `{ maximumFractionDigits: 1, signDisplay: 'negative' }`. −0.04 → `0,0`; the default `auto` gives **`-0,0`**.
- Grouping separator is U+00A0 (`12 345,6`). Never re-parse formatted output.
- `Intl.DateTimeFormat('de-AT', { month: 'long' })` → `Jänner` (verified).
- Browser support for `signDisplay: 'negative'` (Intl.NumberFormat v3) is [ASSUMED: shipped in current Chrome/Safari/Firefox]. The Playwright smoke test on Chromium covers CI only.

### i18n

- `src/i18n/de-AT.js`: `export default Object.freeze({ 'app.title': '…', 'diag.FRONT_SAG_UNDEFINED.title': '…', … })`.
- `t(key, params)` does `{name}` interpolation and **throws** on a missing key (dev/test). In prod it returns the key, so failures are visible, not silent.
- Numbers are never inside strings; the UI formats them and passes them as params.
- `index.html` has `<html lang="de-AT">`. Static text uses `data-i18n` keys filled at startup.

## Frame Outlines (FRAME-01)

Represent the outline as a closed CCW polygon `Float64Array [x0,y0,…]` in the lens-local frame, N = 720, **resampled by arc length**.

Pipeline:
1. Shape function r(φ).
2. Sample densely.
3. Arc-length resample.
4. **Scale x and y separately so the bbox is exactly A × B and centred at the origin.** Boxing centre = bbox centre, not centroid.
5. For OS, mirror x for left-right-asymmetric shapes (Pilot, Panto). This is the only per-eye mirroring.

Shape functions (all are star-shaped about the centre; a unit test casts rays at 3600 angles and asserts exactly one crossing at the min/max A, B):

| Shape | Definition [ASSUMED: design choice, no citable standard] | Default A/B/DBL [ASSUMED] |
|---|---|---|
| Rund | superellipse exponent p = 2 (ellipse; circle when A = B) | 48 × 44 / 20 |
| Rechteckig | superellipse p = 5 | 52 × 38 / 18 (matches the FEATURES.md example "52□18") |
| Panto | upper half p = 3.5, lower half p = 2 (flatter brow, round bottom) | 49 × 42 / 20 |
| Pilot | p = 3 with the lower half widened temporally and tapered nasally (teardrop), e.g. r(φ)·(1 + 0.15·max(0, −sin φ)·(−cos φ·nasalSign)) | 58 × 50 / 14 |

Phase 1 shows the shape select plus pre-filled A/B/DBL numbers (no full validation; FRAME-02 is phase 2). This lets the SC-4 impossible case be demonstrated in the browser.

## CI Workflow (DEPL-01…04)

SHAs were re-resolved 2026-11-06 with `gh api repos/actions/<a>/releases/latest` and `/commits/<tag>` [VERIFIED]:

| Action | Tag | Published | SHA |
|---|---|---|---|
| actions/checkout | v7.0.1 | 2026-07-20 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| actions/setup-node | v7.1.0 | 2026-10-08 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| actions/configure-pages | v6.0.0 | 2026-03-25 | `45bfe0192ca1faeb007ade9deae92b16b8254a0d` |
| actions/upload-pages-artifact | v5.0.0 | 2026-04-10 | `fc324d3547104276b827a68afc52ff2a11cc49c9` |
| actions/deploy-pages | v5.0.1 | 2026-09-01 | `368f82528645a54fb793d4d04e342629a3f51346` |

```yaml
# .github/workflows/deploy.yml
name: CI and Pages deploy
on:
  push: { branches: [main] }
  pull_request:
  workflow_dispatch:
permissions: { contents: read }
concurrency: { group: pages-${{ github.ref }}, cancel-in-progress: false }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm run lint                       # includes engine boundary (DEPL-03)
      - run: npm run test:coverage              # vitest run --coverage; thresholds fail = exit 1
      - run: npm run build                      # VITE_COMMIT from GITHUB_SHA baked into footer
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e                   # smoke vs vite preview at /Eyeglass-Prescription/
      - uses: actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d # v6.0.0
        if: github.event_name != 'pull_request'
      - uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0
        if: github.event_name != 'pull_request'
        with: { path: ./dist }
  deploy:
    needs: build
    if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    permissions: { pages: write, id-token: write }
    environment: { name: github-pages, url: '${{ steps.deployment.outputs.page_url }}' }
    steps:
      - id: deployment
        uses: actions/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346 # v5.0.1
  verify-live:                                  # DEPL-01 + SC-6 evidence, automated
    needs: deploy
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci && npx playwright install --with-deps chromium
      - name: Wait for CDN to serve this commit
        run: |
          for i in $(seq 1 30); do
            curl -fsS https://ainxtgendev.github.io/Eyeglass-Prescription/ | grep -q "${GITHUB_SHA::7}" && exit 0
            sleep 10
          done; exit 1
      - run: npm run test:e2e
        env: { BASE_URL: 'https://ainxtgendev.github.io/Eyeglass-Prescription/' }
```

Supporting files:
- `vite.config.js`: `base: '/Eyeglass-Prescription/'` and `define: { __APP_COMMIT__: JSON.stringify((process.env.GITHUB_SHA ?? 'dev').slice(0, 7)) }`. The footer renders it (lens-critic and bug reports can identify the build).
- `playwright.config.js`: `baseURL: process.env.BASE_URL ?? 'http://localhost:4173/Eyeglass-Prescription/'`, and `webServer` (`vite preview --port 4173 --strictPort`) **only when `BASE_URL` is unset**.
- Smoke assertions:
  - `page.on('response')` has no status ≥ 400 and `page.on('requestfailed')` is empty.
  - No request to a host other than the page origin (privacy: the Rx never leaves the browser).
  - `html[lang=de-AT]`; disclaimer visible; typing `-2,25` / `-1,00` / `90` gives a result with `−2,25 dpt` echoed and finite mm/g; a plus-cyl entry shows both forms; the impossible case shows a German diagnostic; the footer shows the commit.
- `npm run test:e2e` is `playwright test`. Locally the chromium headless shell revision for 1.65 had to be installed (`npx playwright install --only-shell chromium`, done during research).

**DEPL-04 automated check:** a unit test reads `.github/workflows/*.yml` and asserts every `uses:` matches `@[0-9a-f]{40}`. It also reads `package.json` and asserts no version starts with `^`, `~`, `>` or `*`, and that `package-lock.json` exists. CI uses `npm ci`.

**Pages enablement (pre-authorized; SC-6):**
- Command: `gh api -X POST repos/AINxtGenDev/Eyeglass-Prescription/pages -f build_type=workflow`. Body parameter `build_type: legacy|workflow` [CITED: docs.github.com REST "Create a GitHub Pages site"]. It needs repo admin; the local `gh` token has the `repo` and `workflow` scopes (verified).
- Current state (verified 2026-11-06): `has_pages: false`, `GET …/pages` → 404, Actions enabled, `sha_pinning_required: false`.
- **Order:** enable Pages *before* the first push that contains the workflow. Otherwise `configure-pages`/`deploy-pages` fail on run 1. That is recoverable with a re-run, but noisy.
- Verify with `gh api repos/AINxtGenDev/Eyeglass-Prescription/pages --jq '{build_type,html_url,status}'` and expect `build_type: "workflow"`.
- Rollback: `gh api -X DELETE repos/AINxtGenDev/Eyeglass-Prescription/pages`. That is destructive and outward-facing, so ask first.
- **The push itself needs explicit user approval** (see Project Constraints).

**DEPL-02 evidence plan:**
1. Structural: `deploy` `needs: build` and every gate is a step in `build`.
2. Behavioural: open a PR (or a branch push with `workflow_dispatch`) containing a deliberately failing test. It must show `build` red and `deploy` skipped. Do not break `main` on purpose.
3. ESLint-API negative test (Code Examples) proves DEPL-03 inside the unit suite.

## Performance (ENG-09)

Desktop (i7-8809G, Node 22.17): **0.87 ms/lens** for the toric prototype (720-point outline fixed point + one 48×256 grid pass), and 0.24 ms at 24×128. Both lenses ≈ 1.7 ms. A mid-range phone at 3–6× slower would be ≈ 5–10 ms < 16.7 ms [ASSUMED multiplier; must be measured].

Phase 1 has no mesh, so it can run the 24×128 grid (volume error −0.002 %).

Measurement design (human checkpoint, end of phase):
- The page shows, in a collapsed `<details>` "Technische Angaben", "Rechenzeit beide Gläser: Median x,x ms (50 Läufe)".
- The UI measures it with `performance.now()`. `performance` is banned in the engine by lint, and measurement belongs to the UI anyway.
- The user opens the live URL on a real mid-range phone and records device, browser, median and p95 in the phase VERIFICATION. Pass if the median is < 16.7 ms.

## Disclaimer (RES-06), content requirements

It must be persistent, sit next to the result (not only in the footer), and be German. It must say:
- This is an educational visualisation, not a substitute for the optician's measurement or advice.
- The main simplifications:
  - Spherical front surface; no manufacturer aspheric designs.
  - Base curve by Vogel's rule (manufacturers, especially for high-index, often use flatter curves, so real lenses can be thinner).
  - Minimum thicknesses are typical manufacturer values.
  - Lab tolerance about ±0,2 mm.
  - No prism, addition or progressive lenses.
  - Uncut blank and bevel position not modelled.
- Numbers are model values.

Exact wording goes through lens-critic; the copy rules in PITFALLS apply (no "Stärke" for thickness; "Mittendicke"/"Randdicke").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decimal parsing | `parseFloat`, `Number()` | the explicit regex parser above | `parseFloat('-2,25') = −2` (verified) |
| Number display | `toFixed` + string replace | `Intl.NumberFormat('de-AT')` with `signDisplay` | −0 and rounding edge cases (verified) |
| Engine boundary | code review / convention | ESLint `no-restricted-imports` + `no-restricted-globals` + scoped `globals` | verified to catch three/addons/document/window/fetch |
| Property generation | hand loops | fast-check `fc.integer({min,max}).map(k => k/4)` for 0.25 steps | shrinking finds minimal failing Rx |
| Deploy | gh-pages branch / npm `gh-pages` | official Pages actions, SHA-pinned | test gate in the same pipeline |
| Root-finding for ray–surface | generic solver library | Newton on `z − g(x,y)` with analytic gradient | converges in < 10 steps from the vertex-plane seed; already prototyped |

**Key insight:** in this domain the danger is not missing libraries but silently wrong numbers. Every hand-written piece (sag, torus, design) needs an independent check: closed form, manufacturer row, or Snell trace.

## Common Pitfalls (new or sharpened this session)

### Pitfall A: Back-surface curvature sign
**What goes wrong:** `c2 = D2/K` gives a convex back, so ET comes out of the wrong sign (−9 mm instead of +1.1 mm on Zeiss rows).
**How to avoid:** use `c = −D2/K` in `conventions.js`, plus invariant tests.
**Warning signs:** a minus lens is thinnest at the edge, or Zeiss tier 2(a) fails by many mm.

### Pitfall B: ESLint flat-config globals merge
**What goes wrong:** `globals.browser` set for `src/**/*.js` also applies to `src/engine/**`; a later block cannot remove it.
**How to avoid:** set browser globals only for `src/ui/**` (and test/config files get `globals.node`). Keep `no-restricted-globals` as a belt.
**Warning sign:** the negative lint test for `fetch`/`HTMLElement` reports 0 errors (verified failure mode).

### Pitfall C: Per-sheet constraints applied to every chart row
**What goes wrong:** Zeiss uses row-specific CT/ET for low plus and plano. One global minET mis-predicts by 0.6 mm (verified).
**How to avoid:** use the row-constraint rule in Tier 2(c).

### Pitfall D: The oracle doesn't validate torus orientation
**Mitigation:** analytic off-axis tests for the tyre formula and the documented model-difference table.

### Pitfall E: SC-4 example under-specified
"+12 in 62×55" is computable or impossible depending on DBL/PD (table above). Pin all parameters in the test.

### Pitfall F: Push = public deploy
Pushing `main` publishes. It needs user approval per CLAUDE.md, and the global rule says approval does not carry over to later pushes. Batch work so that phase 1 needs few pushes, and get the user's consent for the push cadence once, explicitly.

### Pitfall G: Masked exit codes
`npx vitest run --coverage | tail` returns tail's exit 0 even when thresholds fail (seen during research). CI steps must not pipe test output.

### Pitfall H: Zeiss PDF fetch blocked
Plain curl gets 403. Commit transcribed fixtures (Appendix A) with provenance; don't download in CI.

### Pitfall I: CR-39 ne
1.500 vs 1.502 differs between sheets. Pick 1.500 and document both (see Materials).

## Code Examples

### ESLint boundary (verified in scaffold)
```js
// eslint.config.js
import js from '@eslint/js';
import globals from 'globals';
export default [
  { ignores: ['dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  { files: ['*.config.js', 'test/**/*.js', 'src/**/*.test.js'], languageOptions: { globals: { ...globals.node } } },
  { files: ['src/ui/**/*.js'], languageOptions: { globals: { ...globals.browser } } },   // ONLY ui
  {
    files: ['src/engine/**/*.js'],
    ignores: ['src/engine/**/*.test.js'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['three', 'three/*'], message: 'Engine must not import Three.js (DEPL-03).' },
        { group: ['**/ui/**', '**/i18n/**', '**/state/**'], message: 'Engine is the bottom layer.' } ] }],
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'self', 'localStorage', 'requestAnimationFrame', 'performance', 'fetch'],
    },
  },
];
```

### Negative boundary test (DEPL-03 proof inside the unit suite)
```js
// src/engine/boundary.test.js  (verified pattern: ESLint Node API lintText)
import { test, expect } from 'vitest';
import { ESLint } from 'eslint';
const eslint = new ESLint();
const lint = async (code) => (await eslint.lintText(code, { filePath: 'src/engine/__probe__.js' }))[0];
test.each([
  ["import * as T from 'three'; export const x = T;", 'no-restricted-imports'],
  ["import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; export { OrbitControls };", 'no-restricted-imports'],
  ['export const f = () => document.title;', 'no-restricted-globals'],
  ['export const f = () => [HTMLElement];', 'no-undef'],
])('engine rejects %s', async (code, rule) => {
  const r = await lint(code);
  expect(r.messages.map((m) => m.ruleId)).toContain(rule);
});
```

### Vitest config (verified: projects + thresholds → exit 1)
```js
// vite.config.js
import { defineConfig } from 'vite';
export default defineConfig({
  base: '/Eyeglass-Prescription/',
  define: { __APP_COMMIT__: JSON.stringify((process.env.GITHUB_SHA ?? 'dev').slice(0, 7)) },
  test: {
    coverage: { provider: 'v8', include: ['src/engine/**/*.js'], exclude: ['**/*.test.js'],
                thresholds: { lines: 95, branches: 90 } },
    projects: [{ test: { name: 'unit', environment: 'node', include: ['src/**/*.test.js', 'test/**/*.test.js'] } }],
  },
});
```

### BVP round-trip property (verified, 300 runs)
```js
import fc from 'fast-check';
const q = (lo, hi) => fc.integer({ min: lo * 4, max: hi * 4 }).map((k) => k / 4);
fc.assert(fc.property(q(-12, 12), q(-6, 0), fc.integer({ min: 0, max: 179 }),
  fc.constantFrom(1.5, 1.59, 1.598, 1.664, 1.738), fc.double({ min: 1, max: 12, noNaN: true }),
  (sph, cyl, axisDeg, n, ct) => {
    const D1 = Math.min(10, Math.max(0.5, vogel(sph + cyl / 2)));
    const F = traceBVP(design({ sph, cyl, axisDeg, n, D1, ct }));
    const E = rxToMatrix({ sph, cyl, axisDeg });
    for (const [i, j] of [[0, 0], [0, 1], [1, 1]]) expect(Math.abs(F[i][j] - E[i][j])).toBeLessThan(0.01);
  }), { numRuns: 300, seed: 42 });
```

## Walking-Skeleton Ordering (MVP mode) — recommendation

1. **Skeleton (thin end-to-end):**
   - Scaffold: package.json exact pins, `.nvmrc`, `.npmrc`, vite/eslint/playwright configs, `.gitignore` additions (`coverage/`, `test-results/`, `playwright-report/`).
   - A sphere-only `evaluateLens` stub behind the final `LensResult` shape.
   - `de-AT.js` + `t()`, a minimal German `index.html` with the disclaimer, and the workflow.
   - Local `lint/test/build/e2e` green → **[checkpoint: user approves push]** → enable Pages (pre-authorized) → push → `verify-live` green.
2. **Engine core** (can run in parallel with item 3 once the contract is frozen): conventions, power/Vogel, stable sags + torus, design fixed point, CT solve, decentration, metrics, diagnostics, materials with citations, frame outlines.
3. **State/i18n:** parser, transposition, formatter, the full dictionary for every code.
4. **Validation:** tier 1–4 tests, the Zeiss fixture JSON (Appendix A), the oracle in `trace.js`, the fuzz/NaN test, coverage thresholds.
5. **Page wiring:** per-eye form (R/L × Sph/Zyl/Achse/PD), material and shape selects with pre-filled A/B/DBL, the result table (CT, ET max/min + location, weight, base curve + rule), both cylinder forms, diagnostics, timing readout, build hash.
   - Push (approved) → live verification → **[checkpoint: real-phone timing + lens-critic result review]**.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.eslintrc` + `env` | Flat config only (ESLint 10); globals merge across matching blocks | ESLint 9/10 | scope browser globals precisely |
| Vitest `workspace` file | `test.projects` inline (Vitest 5 projects inherit root config) | Vitest 3–5 | single `vite.config.js` |
| Vite Rollup/esbuild | Rolldown bundler (Vite 8) | Vite 8 | no impact on config here |
| gh-pages branch deploy | Actions artifact deploy (`build_type: workflow`) | 2022+ | test-gated deploys |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The dioptric power matrix formula is the "Harris/Keating" matrix (name/attribution) | Pattern 4 | Low: formula verified for consistency with ENG-01 and by trace; only the citation is at stake |
| A2 | Tyre formation is the toric form used for spectacle lenses (secondary sources only) | Pattern 3 | Medium: off-axis ET differs 0.1–0.4 mm at CYL −6 if barrel is "right"; paraxial power unaffected |
| A3 | Vogel's rule form (secondary teaching sources, no textbook) | MAT-02 | Medium: base curve wrong, so plus CT and protrusion shift; disclaimer covers it |
| A4 | Clamp floor +0.50 D (design choice informed by Zeiss fronts; not a manufacturing limit — Trivex Z00981.FS1 uses 0.15 D @1.530 at −7/−8) | MAT-02 | Low |
| A5 | minET defaults for 1.67/1.74 = 1.0 mm (not read from a sheet row this session) | Materials | Low–Medium: plus-lens CT for these materials off by up to about 0.1 mm |
| A6 | Frame-shape functions and default A/B/DBL per shape | Frame Outlines | Medium for UX realism, none for engine correctness (tested on any outline) |
| A7 | Phone is 3–6× slower than the desktop | Performance | Medium: must be measured (ENG-09 requires it anyway) |
| A8 | `signDisplay: 'negative'` is supported in target browsers | Formatting | Low: fallback is to normalise −0 manually |
| A9 | MBS warning threshold 75 mm (largest Zeiss stock blank on the sheets read; Rx labs have larger) | Diagnostics | Low (warning only) |
| A10 | GitHub `github-pages` environment allows deploys from `main` by default after enablement | CI | Low: verify on the first run |

## Open Questions

1. **SC-4 vs MAT-02: which "+12 in 62×55" must be impossible?**
   - What we know: with the MAT-02 clamp (D1 ≤ 10), +12/62×55/DBL 18/PD 32 computes (CT 26 mm, MBS 89 mm), while DBL 24/PD 25 is `FRONT_SAG_UNDEFINED`.
   - What's unclear: whether the user wants a "not manufacturable" *error* for computable-but-absurd lenses (needs an unsourced CT or blank limit).
   - Recommendation: errors only for mathematical impossibility; warnings for `BLANK_EXCEEDS_STOCK`; pin the SC-4 acceptance test to +12/62×55/DBL 24/PD 25/CR-39 and to −12/−6×10/62×55/CR-39. Put this decision in front of lens-critic.
2. **Torus orientation confirmation.** Tyre per secondary sources. A primary source (Jalie, *Principles of Ophthalmic Lenses*) would settle it. Recommendation: proceed with tyre and document it as `[MEDIUM]`.
3. **Push cadence approval.** CLAUDE.md requires approval per outward-facing action. Recommendation: one checkpoint where the user approves "push phase-1 commits to main as plans complete", or a push only at the skeleton and at the end of the phase.
4. **Fitting height in phase 1** (ENG-05 "optional"). Recommendation: engine supports `fittingHeight`; the phase-1 page omits the field (Expert, phase 2); tests cover it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | v22.17.0 | — |
| npm | install / `npm ci` | ✓ | 11.6.0 | — |
| git + origin (SSH) on `main` | commits/push | ✓ | branch `main` tracking `origin/main`, clean | — |
| gh CLI (auth AINxtGenDev, scopes repo/workflow/read:org/gist) | Pages enable, API checks | ✓ | — | GitHub web UI Settings → Pages |
| Playwright chromium headless shell (rev for 1.65) | local e2e | ✓ (installed into `~/.cache/ms-playwright` during research) | 1.65.0 | `npx playwright install --only-shell chromium` |
| GitHub Pages | DEPL-01 | ✗ not enabled (`has_pages:false`) | — | enable via `gh api` (pre-authorized) |
| Real mid-range phone | ENG-09 | ✗ (human) | — | none; the user must measure (human checkpoint) |
| pdftotext | only for re-extracting fixtures | ✓ | poppler | Appendix A transcription |

**Missing dependencies with no fallback:** a real phone for ENG-09 (human step).
**Missing dependencies with fallback:** Pages (enable step).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 5.1.0 (node env) + fast-check 4.10.2; Playwright 1.65.0 (chromium) |
| Config file | none yet; Wave 0 creates `vite.config.js` (test.projects + coverage) and `playwright.config.js` |
| Quick run command | `npx vitest run --project unit` (< 5 s expected; prototype suites ran in about 0.2 s) |
| Full suite command | `npm run lint && npx vitest run --coverage && npm run build && npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEPL-01 | built site loads under base, no 4xx/failed requests, no third-party hosts | e2e | `npx playwright test e2e/smoke.spec.js` (+ `BASE_URL=<live>` in verify-live) | ❌ Wave 0 |
| DEPL-02 | failing gate blocks deploy | structural + manual PR demo | `node test/ci/workflow-structure.test.js` via vitest (asserts `deploy.needs == build`, gates present, no `continue-on-error`) | ❌ Wave 0 |
| DEPL-03 | engine import/DOM ban | unit (ESLint API) | `npx vitest run src/engine/boundary.test.js` | ❌ Wave 0 |
| DEPL-04 | SHA pins + exact npm pins | unit | `npx vitest run test/ci/pins.test.js` | ❌ Wave 0 |
| ENG-01 | D(θ) identities, power matrix | unit | `npx vitest run src/engine/power.test.js` | ❌ |
| ENG-02 | BVP round trip ≤ 0.01 D full range | property (oracle) | `npx vitest run src/engine/trace.test.js` | ❌ |
| ENG-03 | torus exact on principal meridians, stable at c→0, domain → NaN | unit | `npx vitest run src/engine/sag.test.js` | ❌ |
| ENG-04 | CT solve incl. mixed meridians; outline convergence 720 vs 5760; axis-sweep continuity | unit + property | `npx vitest run src/engine/solve.test.js` | ❌ |
| ENG-05 | dec sign per eye, nasal/temporal asymmetry, OD/OS not mirrored for oblique cyl | unit | `npx vitest run src/engine/evaluate.test.js -t decentration` | ❌ |
| ENG-06 | metrics, volume vs closed form, weight | unit | `npx vitest run src/engine/metrics.test.js` | ❌ |
| ENG-07 | impossible cases → codes; no NaN in fuzz | unit + property | `npx vitest run src/engine/diagnostics.test.js` | ❌ |
| ENG-08 | Zeiss rows (a)(b)(c) | fixture | `npx vitest run test/fixtures/zeiss.test.js` | ❌ |
| ENG-09 | recompute < 16.7 ms on phone | manual (live page readout) + informational desktop log | n/a: human checkpoint, result recorded in VERIFICATION | manual-only (needs device) |
| MAT-01 | every material row has ne/nd/νe/νd/ρ/source; engine uses ne | unit | `npx vitest run src/engine/materials.test.js` | ❌ |
| MAT-02 | Vogel worked examples, clamp, `BASE_CURVE_CLAMPED` | unit | `npx vitest run src/engine/power.test.js -t vogel` | ❌ |
| RX-02 | parser table (above) + echo format | unit | `npx vitest run src/state/parse.test.js src/i18n/format.test.js` | ❌ |
| RX-03 | transposition and both forms | unit + e2e | `npx vitest run src/state/transpose.test.js` | ❌ |
| FRAME-01 | bbox exactly A×B, star-shaped at range extremes, OS mirror for asymmetric shapes | unit | `npx vitest run src/engine/frame/outline.test.js` | ❌ |
| L10N-01 | `lang=de-AT`, −0 handling, U+2212 echo | unit + e2e | `npx vitest run src/i18n/format.test.js` | ❌ |
| L10N-02 | every code has dictionary keys, no orphans; `t()` throws on missing | unit | `npx vitest run src/i18n/dictionary.test.js` | ❌ |
| RES-06 | disclaimer visible next to result | e2e | smoke spec | ❌ |

### Sampling Rate
- **Per task commit:** `npx vitest run --project unit`
- **Per wave merge:** full suite command
- **Phase gate:** full suite green locally and in CI, `verify-live` green, real-phone timing recorded, lens-critic PASS, before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `package.json` scripts: `lint`, `test`, `test:coverage`, `build`, `preview`, `test:e2e`
- [ ] `vite.config.js`, `eslint.config.js`, `playwright.config.js`, `.nvmrc`, `.npmrc`
- [ ] `src/engine/boundary.test.js`, `test/ci/pins.test.js`, `test/ci/workflow-structure.test.js`
- [ ] `test/fixtures/zeiss-fsv-6-23-cr39-spherical.json` (Appendix A) + loader
- [ ] `e2e/smoke.spec.js`
- [ ] Framework install: the `npm install -D --save-exact …` line above; `npx playwright install --with-deps chromium` in CI

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | static site, no accounts |
| V3 Session Management | no | — |
| V4 Access Control | no (site); yes (CI) | workflow `permissions: contents: read`; `pages: write`/`id-token: write` on the deploy job only |
| V5 Input Validation | yes | strict regex parser, codes not exceptions, never clamp; output via `textContent`, never `innerHTML` with user or dictionary content |
| V6 Cryptography | no | — |
| V10 Malicious Code / V14 Config (supply chain) | yes | SHA-pinned actions, exact npm pins + lockfile + `npm ci`, no CDN scripts, no third-party requests (smoke asserts) |

### Known Threat Patterns for static Vite site + GitHub Actions

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Action tag hijack / compromised release | Tampering | 40-char SHA pins (pin test) |
| Over-privileged workflow token | Elevation | job-scoped permissions; deploy job isolated |
| Health data (Rx) exfiltration | Information disclosure | no analytics, no network calls, no storage in phase 1; smoke asserts same-origin requests only (GDPR Art. 9 context in PITFALLS) |
| DOM XSS via rendered strings | Tampering | `textContent` only; dictionary values are trusted constants; optional `<meta http-equiv="Content-Security-Policy" content="default-src 'self'">` (Pages can't set headers) [ASSUMED compatible with Vite module output: verify in smoke] |
| Accidental publication of `references/` | Information disclosure | git-ignored (verified in `.gitignore`); not under `public/`; smoke/build check that `dist/` contains no `references` paths |
| Dependency vuln in dev tooling | Tampering | dev-only minimatch advisory accepted; never shipped |

## Sources

### Primary (HIGH)
- ZEISS Finished Single Vision Fact Sheets, Version 6/23: https://www.zeiss.com/content/dam/vis-b2b/usa/downloads/pdfs/fsv2023.pdf. Downloaded and parsed this session; 150 pages. CR-39 spherical sheets doc 00523.FS1 (75 mm doc p.124–127, 70 mm p.132–135, 65 mm p.140–143); material blocks of every sheet; "All curves are in 1.530 Index"; "No lens to be sold with a CT under 1.6mm"; CT tolerances.
- ZEISS ClearView FSV Fact Sheets, Version 6/23: https://www.zeiss.com/content/dam/vis-b2b/usa/downloads/pdfs/clearview-lensspec.pdf. 1.60/1.67/1.74 constants; 1.60 minus CT 1.2, plus ET 1.1.
- npm registry (`npm view`, api.npmjs.org downloads) for all package versions, engines, postinstall, repos (2026-11-06).
- GitHub API: action releases and SHAs; repo `has_pages:false`, Pages 404, Actions permissions (2026-11-06).
- GitHub REST docs, Create a GitHub Pages site (`build_type: legacy|workflow`): https://docs.github.com/en/rest/pages/pages?apiVersion=2022-11-28#create-a-github-pages-site
- Scratch prototypes (this session, not shipped): `proto/fixtures.mjs`, `e2e_row.mjs`, `engine.mjs`, `oracle.mjs`, `ctsolve.mjs`, `impossible.mjs`, `volume.mjs`, `bench3.mjs`; scaffold runs of eslint/vitest/vite/playwright.

### Secondary (MEDIUM)
- Vogel's rule formulas and worked examples: https://open-exam-prep.com/study-guides/abo-advanced/optics-ii/thickness-magnification-effective-power ; https://www.optiboard.com/forums/forum/optical-forums/general-optics-and-eyecare-discussion-forum/36802-please-help-me-to-understand?p=510550 ; https://www.slideshare.net/slideshow/base-curve/171650126
- TABO / ISO 8429 (CCW, 90° vertical, 0–180, zero on the right of the dial): https://www.chinesestandard.net/PDF.aspx/GBT40177-2021 ; OCULUS trial-frame FAQ (conforms to DIN EN ISO 8429, no detail): https://www.oculus.de/en/faq-items/does-the-scale-on-oculus-universal-trial-frames-for-reading-the-axis-and-base-position-conform-to-the-tabo-graduated-arc-scale-according-to-din-en-iso-8429/
- Toric tyre/barrel/capstan, tyre used for spectacle lenses: https://es2.slideshare.net/rajukaiti/spherical-cylindrical-and-toric-lenses ; https://brainscape.com/flashcards/1-terminology-complete-14769790/packs/21776266 ; base vs cross curve: https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/3960442

### Tertiary (LOW)
- Phone speed multiplier; frame shape parameters; Harris/Keating attribution (training knowledge).

## Appendix A: Zeiss CR-39 spherical fixture rows (transcribed 2026-11-06)

Source: ZEISS FSV fact sheets Version 6/23, "synchrony Finished SV SPH 1.5 HC [USA]" (doc 00523.FS1), material ne = 1.500, nd = 1.499, νe 56, ρ 1.32. Format `F/front/back/CT/ET`: powers in D; front and back curves in **1.530 tool index** (back printed negative = concave); CT/ET in mm at the uncut diameter d (radius d/2), centred, spherical geometry. PDF page = document page + 3.

- **d = 75 (doc p.126, plus):** 4/7.77/-3.8/7.2/1.1 3.75/7.53/-3.8/6.8/1.1 3.5/7.3/-3.8/6.4/1.1 3.25/7.06/-3.8/6/1.1 3/7.25/-4.25/5.7/1.1 2.75/7/-4.25/5.3/1.1 2.5/6.76/-4.25/4.9/1.1 2.25/6.52/-4.25/4.5/1.1 2/6.71/-4.7/4.2/1.1 1.75/6.46/-4.7/3.8/1.1 1.5/6.21/-4.7/3.4/1.1 1.25/5.96/-4.7/3/1.1 1/6.13/-5.15/3.2/1.7 0.75/5.88/-5.15/2.8/1.7 0.5/5.63/-5.15/2.4/1.7 0.25/5.36/-5.15/2/1.7
- **d = 75 (doc p.127, minus):** 0/5.46/-5.5/2/2.1 -0.25/5.2/-5.5/1.8/2.3 -0.5/4.94/-5.5/1.8/2.6 -0.75/4.68/-5.5/1.8/3 -1/4.41/-5.5/1.8/3.4 -1.25/4.65/-6/1.8/3.8 -1.5/4.38/-6/1.8/4.2 -1.75/4.12/-6/1.8/4.6 -2/3.86/-6/1.8/5 -2.25/4.09/-6.5/1.8/5.4 -2.5/3.83/-6.5/1.8/5.8 -2.75/3.56/-6.5/1.8/6.1 -3/3.3/-6.5/1.8/6.5 -3.25/3.53/-7/1.8/7 -3.5/3.27/-7/1.8/7.3 -3.75/3.01/-7/1.8/7.7 -4/2.74/-7/1.8/8.1 -4.25/2.97/-7.5/1.8/8.6 -4.5/2.71/-7.5/1.8/8.9 -4.75/2.45/-7.5/1.8/9.3 -5/2.18/-7.5/1.8/9.7 -5.25/2.42/-8/1.8/10.2 -5.5/2.15/-8/1.8/10.6 -5.75/1.89/-8/1.8/10.9 -6/1.62/-8/1.8/11.3
- **d = 70 (doc p.134, plus):** 5/7.86/-2.85/7.5/1 4.75/7.63/-2.85/7.1/1 4.5/7.39/-2.85/6.8/1 4.25/7.53/-3.25/6.5/1 4/7.3/-3.25/6.2/1 3.75/7.05/-3.25/5.8/1 3.5/6.8/-3.25/5.5/1 3.25/7.04/-3.75/5.2/1 3/6.79/-3.75/4.9/1 2.75/6.55/-3.75/4.6/1 2.5/6.3/-3.75/4.2/1 2.25/6.48/-4.2/3.9/1 2/6.24/-4.2/3.6/1 1.75/5.98/-4.2/3.3/1 1.5/5.73/-4.2/2.9/1 1.25/5.92/-4.65/2.6/1 1/5.67/-4.65/2.3/1 0.75/5.41/-4.65/2/1 0.5/5.15/-4.65/2/1.4 0.25/5.3/-5.07/2/1.7
- **d = 70 (doc p.135, minus):** 0/5.71/-5.75/2/2.1 -0.25/5.45/-5.75/1.8/2.2 -0.5/5.19/-5.75/1.8/2.5 -0.75/4.93/-5.75/1.8/2.9 -1/4.66/-5.75/1.8/3.2 -1.25/5.14/-6.5/1.8/3.6 -1.5/4.88/-6.5/1.8/3.9 -1.75/4.62/-6.5/1.8/4.2 -2/4.35/-6.5/1.8/4.6 -2.25/4.59/-7/1.8/5 -2.5/4.32/-7/1.8/5.3 -2.75/4.06/-7/1.8/5.6 -3/3.8/-7/1.8/5.9 -3.25/4.03/-7.5/1.8/6.3 -3.5/3.77/-7.5/1.8/6.7 -3.75/3.5/-7.5/1.8/7 -4/3.24/-7.5/1.8/7.3 -4.25/3.47/-8/1.8/7.8 -4.5/3.21/-8/1.8/8.1 -4.75/2.95/-8/1.8/8.4 -5/2.68/-8/1.8/8.7 -5.25/2.42/-8/1.8/9 -5.5/2.15/-8/1.8/9.3 -5.75/1.89/-8/1.8/9.6 -6/1.62/-8/1.8/9.9 -6.25/2.36/-9/1.8/10.6 -6.5/2.09/-9/1.8/10.9 -6.75/1.83/-9/1.8/11.2 -7/1.56/-9/1.8/11.5 -7.25/2.29/-10/1.8/12.3 -7.5/2.03/-10/1.8/12.6 -7.75/1.77/-10/1.8/13 -8/1.5/-10/1.8/13.3
- **d = 65 (doc p.142, plus):** 6/8.78/-2.8/7.7/1 5.75/8.55/-2.8/7.4/1 5.5/8.32/-2.8/7.1/1 5.25/8.09/-2.8/6.8/1 5/7.85/-2.8/6.5/1 4.75/7.61/-2.8/6.2/1 4.5/7.37/-2.8/6/1 4.25/7.55/-3.25/5.7/1 4/7.31/-3.25/5.4/1 3.75/7.07/-3.25/5.1/1 3.5/6.82/-3.25/4.9/1 3.25/7.05/-3.75/4.6/1 3/6.81/-3.75/4.3/1 2.75/6.56/-3.75/4/1 2.5/6.31/-3.75/3.8/1 2.25/6.54/-4.25/3.5/1 2/6.29/-4.25/3.2/1 1.75/6.04/-4.25/3/1 1.5/5.79/-4.25/2.7/1 1.25/5.92/-4.65/2.4/1 1/5.67/-4.65/2.1/1 0.75/5.41/-4.65/2/1.2 0.5/5.15/-4.65/2/1.5 0.25/5.3/-5.07/2/1.7
- **d = 65 (doc p.143, minus):** 0/5.71/-5.75/2/2 -0.25/5.45/-5.75/1.8/2.1 -0.5/5.19/-5.75/1.8/2.4 -0.75/4.93/-5.75/1.8/2.7 -1/4.66/-5.75/1.8/3 -1.25/5.14/-6.5/1.8/3.3 -1.5/4.88/-6.5/1.8/3.6 -1.75/4.62/-6.5/1.8/3.9 -2/4.35/-6.5/1.8/4.1 -2.25/4.59/-7/1.8/4.5 -2.5/4.32/-7/1.8/4.7 -2.75/4.06/-7/1.8/5 -3/3.8/-7/1.8/5.3 -3.25/4.03/-7.5/1.8/5.6 -3.5/3.77/-7.5/1.8/5.9 -3.75/3.5/-7.5/1.8/6.2 -4/3.24/-7.5/1.8/6.5 -4.25/3.47/-8/1.8/6.8 -4.5/3.21/-8/1.8/7.1 -4.75/2.95/-8/1.8/7.4 -5/2.68/-8/1.8/7.6 -5.25/2.42/-8/1.8/7.9 -5.5/2.15/-8/1.8/8.2 -5.75/1.89/-8/1.8/8.4 -6/1.62/-8/1.8/8.7

Spot-check (from the PDF text, by hand): 75 mm −4.00 → front 2.74, back −7.00, CT 1.8, ET 8.1; 70 mm +5.00 → 7.86 / −2.85 / 7.5 / 1.0. The executor should re-verify a few rows against the PDF (needs a browser User-Agent to download) before freezing the JSON.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Versions, engines, postinstall and legitimacy verified; configs exercised in a scaffold.
- Engine math and test design: HIGH. Prototyped and checked against 143 manufacturer rows and an independent Snell trace. MEDIUM on the torus orientation and Vogel provenance.
- CI / Pages: HIGH for SHAs and the API; MEDIUM for first-run environment behaviour (A10).
- Pitfalls: HIGH (each new pitfall was reproduced this session).

**Research date:** 2026-11-06
**Valid until:** 2026-12-06 for the toolchain and action SHAs (fast-moving); the optics content is stable.
