# Stack Research

**Domain:** Static, offline-capable browser 3D simulator (Three.js) with a pure-JS, unit-tested numerical optics engine; GitHub Pages hosting; mid-range-phone performance target
**Researched:** 2026-11-06
**Confidence:** HIGH for versions and deploy pipeline (verified against npm registry, GitHub API, official docs on 2026-11-06); MEDIUM for UI/accessibility and renderer-choice rationale (official docs + reasoning); LOW items flagged inline.

---

## TL;DR (prescriptive)

- **Three.js r187 (`three@0.187.0`) with `WebGLRenderer`**, not `WebGPURenderer`. `MeshPhysicalMaterial` transmission for the default look. The exact "ray-traced" mode is a GLSL `ShaderMaterial` that intersects the analytic lens surfaces per pixel.
- **Vite 8.3.x** for building (`base: '/Eyeglass-Prescription/'`). **Vitest 5.1.x** in the `node` environment for the engine. **Playwright 1.65 + axe-core** for smoke, accessibility and real-browser tests against `vite preview`.
- **UI: vanilla ES modules with native HTML controls in the light DOM.** No framework, no Shadow DOM. At most, light-DOM custom elements with no shadow root, plus `@preact/signals-core` (framework-agnostic, about 1.6 KB) or a hand-written 30-line store for reactive state.
- **i18n: a flat `en.js` dictionary plus a `t(key, params)` helper.** Use `Intl.NumberFormat` and `Intl.PluralRules` for formatting and plurals. No i18n library.
- **Offline: `vite-plugin-pwa@2.0.0`** (Workbox 7.4.1) using `generateSW` and `registerType: 'prompt'`, with its scope set to the sub-path.
- **Deploy: one GitHub Actions workflow.** It runs `test` → `build` → `deploy` using `actions/configure-pages@v6`, `actions/upload-pages-artifact@v5` and `actions/deploy-pages@v5`, all SHA-pinned. Repo setting: **Settings → Pages → Source: GitHub Actions**. Pages is **not enabled yet** on the repo (verified, see Deployment section).

---

## Recommended Stack

### Core Technologies

| Technology | Version (pin exact) | Purpose | Why Recommended | Confidence |
|---|---|---|---|---|
| three | 0.187.0 (r187, released 2026-10-30) | 3D rendering, BufferGeometry, materials, OrbitControls (addon) | The de-facto standard for browser 3D. It has the procedural `BufferGeometry` API, a mature `MeshPhysicalMaterial` with `transmission`/`ior`/`thickness`, and the controls addons. Pin it exactly: Three.js has no semver, and every release removes deprecated APIs (r187 notes: "Remove code deprecated in r177"). | HIGH (npm, GitHub releases) |
| `WebGLRenderer` (built into three) | r187 | Renderer for v1 | The official manual still says `WebGPURenderer` is "still in an experimental state" and that some apps get "missing features or a better performance with `WebGLRenderer`". On mid-range Android (no WebGPU on Firefox Android; Chrome Android only on Android 12+ with Qualcomm/ARM GPUs), `WebGPURenderer` would mostly run its WebGL2 fallback backend anyway. So we would pay its maturity risk without getting its benefit. `WebGLRenderer` transmission is mature and has `transmissionResolutionScale`, a mobile-performance lever. | MEDIUM (official manual + web.dev support matrix; the device mix is inferred) |
| Vite | 8.3.6 | Dev server, production build, `base` sub-path rewriting | It is the minimal-build tool the spec allows. Vite 8 uses Rolldown (Rust) as its only bundler. It requires Node `^20.19 \|\| >=22.12`. It rewrites asset URLs for `base`, has an official GitHub Pages guide, and Vitest shares its config. | HIGH (npm engines, vite.dev blog/guide) |
| Vitest | 5.1.0 | Unit tests for the engine, plus property and benchmark tests | Native ESM, zero-config with Vite, `toBeCloseTo` for numeric tolerances, built-in `bench` for re-mesh performance budgets, and v8 coverage. Needs Node `^22.12 \|\| ^24 \|\| >=26` (the local machine runs v22.17.0, which qualifies). | HIGH (npm, vitest.dev/blog/vitest-5) |
| Node.js | 22.x LTS locally and in CI (`.nvmrc` = `22`) | Toolchain runtime | The local machine has v22.17.0. This satisfies Vite 8, Vitest 5, ESLint 10 and axe-core/playwright (all need ≥22.12 or less). Pin CI to the same major to avoid works-locally drift. Node 22 is in maintenance LTS until 2027-04 (from memory; plan to bump to 24). | HIGH for compatibility, MEDIUM for the EOL date |
| Plain JavaScript (ES2022+ modules) + JSDoc | — | Source language | The spec says JS. JSDoc types on the engine's public API give editor help and an optional type check without a compile step. | HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---|---|---|---|---|
| `three/addons/controls/OrbitControls.js` | ships with three 0.187.0 | Rotate/pan/zoom with touch. `listenToKeyEvents(el)` for keyboard, `enableDamping` | Always. Camera presets (Front/Side/Top) animate `camera.position` and `controls.target`, then call `controls.update()`. Default touches are `ONE: ROTATE, TWO: DOLLY_PAN`. Set `renderer.domElement.style.touchAction = 'none'` only on the canvas, so the control panel still scrolls. | HIGH (Context7 `/mrdoob/three.js`, OrbitControls source) |
| `vite-plugin-pwa` | 2.0.0 (pulls `workbox-build`/`workbox-window` 7.4.1) | Service worker precache and manifest, so the app runs offline after the first load | From phase 1 or 2, as soon as there is something worth caching. Peer range includes Vite 8. | HIGH for versions; MEDIUM for config details |
| `@preact/signals-core` | 1.14.5 | Optional framework-agnostic reactive state (`signal`, `computed`, `effect`) linking inputs → engine → 3D/summary | Use it if the state graph (two eyes × Rx, frame, material, compare A/B, Simple/Expert) outgrows a hand-written observer. It has no Preact or JSX dependency. **Default: start with a tiny hand-written store and adopt this only if needed** (simplicity rule). | MEDIUM |
| `fast-check` | 4.10.2 (dev) | Property-based tests for engine invariants | Engine phase. Examples: thickness ≥ min everywhere on the outline; CYL=0 means rotational symmetry; Rx transposition round-trips; D(θ) is periodic with π. This catches sign-convention bugs that hand-picked examples miss. | HIGH (npm) |
| `@playwright/test` | 1.65.0 (dev) | Real-browser smoke tests against `vite preview` at the sub-path, WebGL canvas present, mobile viewport emulation | From phase 1: a "deployed build loads under `/Eyeglass-Prescription/` with no 404s" test. | HIGH (npm) |
| `@axe-core/playwright` | 4.14.0 (dev) | Automated WCAG checks inside Playwright | Every UI phase. Note that axe covers only part of WCAG; keyboard-path and screen-reader checks stay manual. | HIGH (npm) |
| `typescript` | 7.0.2 (dev, optional) | `tsc --noEmit --checkJs` on `src/engine/**` only | Optional. TS 7 (Go-native) tightened JSDoc handling (no `@enum`, no Closure-style function syntax, no postfix `!`). Write JSDoc in modern TS style. If TS 7 causes friction, pin `typescript@6.0.3`. | LOW–MEDIUM (secondary sources on the TS 7 JSDoc changes) |

**No other runtime dependencies.** Here is how the remaining needs are covered:
- Heatmap: a hand-coded colour-blind-safe LUT (viridis/cividis, about 10 stops) written into a `color` `BufferAttribute`. Always paired with a numeric legend and callouts.
- 2D cross-section: inline **SVG** generated from engine output. SVG is crisp, gives selectable text and dimension labels, and screen readers can read it via `<title>`/`<desc>`. It is a better fit than canvas or Three.js here.
- Number parsing: a custom `parseDiopter()` that accepts `-2,25`, `+1` and `−` (U+2212). **Never `parseFloat`**: `parseFloat('-2,25') === -2` silently drops the fraction.

### Development Tools

| Tool | Version | Purpose | Notes |
|---|---|---|---|
| ESLint | 10.14.0 + `@eslint/js` 10.0.1 + `globals` 17.14.0 | Linting | Flat config only (ESLint 10). Add a `no-restricted-imports` rule for `src/engine/**` that bans `three` and DOM globals (`globals.node`/ES only, no `globals.browser`). This **enforces the "engine has no DOM/Three.js" boundary** mechanically instead of by convention. |
| Prettier | 3.9.10 + `eslint-config-prettier` 10.1.8 | Formatting | Keeps formatting out of code review. |
| `@vitest/coverage-v8` | 5.1.0 (must equal the vitest version) | Engine coverage | Set `coverage.thresholds` on `src/engine/**` only (for example 95% lines). UI coverage is not meaningful. |
| `vite preview` | — | Local check of the production build under the real `base` | Serves at `http://localhost:4173/Eyeglass-Prescription/`. This is the only local way to catch base-path bugs before Pages does. |

---

## Three.js: Relevant APIs and How to Use Them Here

### Procedural lens geometry (`BufferGeometry`)
- Build the front surface, back surface and edge band as `BufferGeometry` with `position`, `normal`, `color` (heatmap) and `index` attributes. Use `Float32Array` buffers sized once per resolution level and **reuse them on re-mesh**: write in place, set `attr.needsUpdate = true`, call `geometry.computeBoundingSphere()`. Do not allocate new geometries per keystroke (GC hitches on phones).
- **Compute normals analytically** from the surface gradient (∂s/∂x, ∂s/∂y). The engine already has the sag function, so this is cheap and exact. `computeVertexNormals()` is wrong at the hard edge between the surface and the edge band unless vertices are split. The edge band needs its own duplicated vertices.
- Sample on a polar grid (rings × spokes) clipped to the frame outline, or on a grid with the outline as the boundary ring. The engine produces the point arrays (plain `Float32Array`s); the view only wraps them. This keeps the engine Three-free and testable.
- If a re-mesh misses the frame budget on a phone, move the engine call into a **Web Worker** (`new Worker(new URL('./engine.worker.js', import.meta.url), { type: 'module' })`; Vite supports this natively) and transfer the buffers. The engine being pure JS makes this a mechanical change. Recommendation: design the engine API as `compute(params) → { typed arrays, metrics }` from day one so this stays an option.

### Baseline refraction: `MeshPhysicalMaterial`
- `transmission: 1`, `ior: n` (1.50–1.74), `thickness: <mm in mesh units>`, `roughness: 0`, `opacity: 1` (the docs require `opacity` 1 when transmission is non-zero). `attenuationColor`/`attenuationDistance` can be used for a faint tint. `dispersion` exists and could be driven from the Abbe number as a nice-to-have.
- It is a **screen-space approximation**: it samples a blurred render of the opaque scene behind the object, offset by a thickness-based refraction vector. It does not trace through the real two-surface geometry. Label it that way in the UI.
- Mobile lever: `renderer.transmissionResolutionScale` (default 1; docs: "Lowering this value can result in significant performance improvements"). Use about 0.5 on phones. Also cap `setPixelRatio(Math.min(devicePixelRatio, 2))`.

### Accurate mode: analytic per-pixel ray trace in a GLSL `ShaderMaterial` (WebGLRenderer)
- **Recommended approach.** The lens surfaces are analytic (spherical/conic front, toric back). A fragment shader on the lens mesh, or on a full-screen quad behind it, can:
  1. Take the view ray at the front-surface hit.
  2. `refract()` with n.
  3. Intersect the back surface: closed form for a sphere, a few Newton iterations for conic/toric.
  4. `refract()` again.
  5. Intersect the eye-chart plane and sample its texture.

  This gives exact magnification/minification and cylinder distortion for a handful of ALU ops per pixel, which is fine on mid-range phones. It works on WebGL2 everywhere.
- **Verification hook (important for lens-critic):** implement the same ray trace as a **pure-JS reference in the engine** (unit-tested against paraxial magnification and known spectacle-magnification values). Then test the GLSL port against it: render a test grid and compare a few sampled UVs in a Playwright test. Otherwise the shader becomes untested optics.
- Why not TSL / WebGPURenderer for this: TSL shaders only run on `WebGPURenderer` (the manual: `ShaderMaterial`, `RawShaderMaterial` and `onBeforeCompile` are not supported there, and the reverse is also true). Choosing TSL would force the whole app onto the renderer the docs still call experimental. Revisit at v2 if `WebGPURenderer` drops the "experimental" label; the reference-JS-first design makes a port cheap.

### Renderer decision summary

| | WebGLRenderer (chosen) | WebGPURenderer + TSL |
|---|---|---|
| Status per official manual | Stable | "still in an experimental state" |
| Phone reality | WebGL2 everywhere | WebGPU on iOS/iPadOS 26+, Chrome Android 12+ (Qualcomm/ARM), no Firefox Android. Otherwise WebGL2 fallback |
| Custom shader path | GLSL `ShaderMaterial` | TSL node materials only |
| Import | `three` | `three/webgpu`, `three/tsl` |

---

## UI Approach: Vanilla HTML-first, Light DOM (justified against usability and a11y)

**Recommendation: semantic native HTML plus small vanilla ES modules. No framework, no Shadow DOM.** Confidence: MEDIUM. This is reasoned from platform facts; the Shadow DOM ARIA limitation is well documented, but the status of its fix is uncertain.

Why this fits "non-expert usability + accessibility" better than Lit, Preact or React:

1. **The best accessible controls are native ones.** The paper-Rx layout is a real `<table>` with `<th scope>` headers (R/OD, L/OS × SPH/CYL/AXIS/PD), so screen readers announce "Right eye, Sphere". The cells are `<input type="text" inputmode="decimal">`. Use `inputmode="decimal"`, not `type="number"`: `type="number"` rejects `-2,25` in many locales and breaks the comma requirement. Explanations use `<button aria-expanded>` with a disclosure region, or the Popover API. Simple/Expert is a native `<details>` or a toggle button. Frame and material use `<select>` or a radio group. All of these come with keyboard, focus and AT semantics for free.
2. **Shadow DOM breaks ID-based ARIA across the shadow boundary.** `<label for>`, `aria-describedby` (needed to link each input to its validation message and explanation) and `aria-labelledby` cannot reference elements in another shadow root. The fix, **Reference Target**, is shipping in Chromium first; Firefox and Safari status is unconfirmed (LOW confidence on cross-browser status). Lit's default is a shadow root per component, so it fights exactly the a11y wiring this project needs. If custom elements are wanted for structure, use **light-DOM custom elements** (no `attachShadow`).
3. **The UI is small and form-shaped.** It has about 30 inputs, a summary, a compare view and a canvas. A virtual DOM buys little here, and the spec asks for minimal tooling and long-lived maintainability. Preact 11 would be the right call only if the compare view grows into many dynamic, re-rendered panels. In that case use Preact with `htm` or JSX, still rendering native elements into the light DOM.
4. **Friendly validation needs full control over messaging.** Use `aria-invalid` + `aria-describedby` → a message element, plus a polite `aria-live` summary. Do not rely on the browser's native validation bubbles: they are inconsistent, clamp-like and not localisable.

**Phone layout:** CSS grid with the canvas in a sticky top region (about 40–45 svh) and the controls scrolling below. Use container queries for the panel. Touch targets ≥ 44×44 px. Give the canvas `touch-action: none` so OrbitControls gets gestures; leave the panel's touch-action alone.

---

## i18n String Structure

- `src/i18n/en.js` exports a **flat, namespaced key map**, e.g. `'rx.sph.label': 'SPH — Sphere'`, `'rx.sph.help': '…'`, `'validation.cylWithoutAxis': 'You entered a cylinder ({cyl}) but no axis…'`. Later `de-AT.js` mirrors it.
- `t(key, params)` does `{name}` interpolation. Missing key: in dev, throw; in prod, fall back to English. A Vitest test asserts that every locale has the same key set as `en`.
- **Numbers never live inside translated strings.** Format them with `Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })` and `{ style: 'unit', unit: 'millimeter' }` / `'gram'`. Use `Intl.PluralRules` if plurals appear. For signed diopters use `signDisplay: 'exceptZero'`.
- **Input parsing and UI language are separate concerns.** Accept both `.` and `,` regardless of the UI language. The engine always receives JS numbers.
- Static HTML text gets `data-i18n="key"` and is filled at startup. Set `<html lang>` from the active locale.
- No i18next or FormatJS: about 100–200 strings and one locale do not justify 30–60 KB plus ICU tooling.

---

## Deployment: GitHub Pages at the `/Eyeglass-Prescription/` Sub-path (hard requirement, phase 1)

### Verified facts (2026-11-06)

- Repo `AINxtGenDev/Eyeglass-Prescription`: `visibility: public`, `default_branch: main`, **`has_pages: false`**. `GET /repos/…/pages` returns 404. **Pages is not enabled yet** (`gh api repos/AINxtGenDev/Eyeglass-Prescription`).
- Current official action releases. Tags were resolved to commit SHAs via `gh api repos/<action>/commits/<tag>`, and they match the SHAs in Vite's official GitHub Pages guide:

| Action | Latest release | Commit SHA |
|---|---|---|
| actions/checkout | v7.0.1 (2026-07-20) | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| actions/setup-node | v7.1.0 (2026-10-08) | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| actions/configure-pages | v6.0.0 (2026-03-25) | `45bfe0192ca1faeb007ade9deae92b16b8254a0d` |
| actions/upload-pages-artifact | v5.0.0 (2026-04-10) | `fc324d3547104276b827a68afc52ff2a11cc49c9` |
| actions/deploy-pages | v5.0.1 (2026-09-01) | `368f82528645a54fb793d4d04e342629a3f51346` |

### One-time repo setting (manual, outward-facing; the user does it or explicitly approves it)
**Settings → Pages → Build and deployment → Source: "GitHub Actions"** (Vite guide). The API equivalent is `gh api -X POST repos/AINxtGenDev/Eyeglass-Prescription/pages -f build_type=workflow`. Ask before running it. The default `GITHUB_TOKEN` in the workflow cannot reliably enable Pages itself (`configure-pages`' `enablement` input needs a token with admin rights; from memory, MEDIUM). So treat this as a prerequisite step of phase 1, not something the workflow does.

### Vite config

```js
// vite.config.js
import { defineConfig } from 'vite';
export default defineConfig({
  base: '/Eyeglass-Prescription/',   // case-sensitive; must match the repo name exactly
  test: {
    projects: [
      { test: { name: 'engine', environment: 'node', include: ['src/engine/**/*.test.js'] } },
      { test: { name: 'ui', environment: 'jsdom', include: ['src/ui/**/*.test.js'] } }, // add only if needed
    ],
  },
});
```
(Vitest 5: inline projects now inherit root config by default.)

### Workflow: test gates deploy

```yaml
# .github/workflows/deploy.yml
name: CI and Pages deploy
on:
  push: { branches: [main] }
  pull_request:            # tests only; deploy job is skipped
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
      - run: npm run lint
      - run: npm test -- --run          # Vitest; non-zero exit fails the job → no deploy
      - run: npm run build
      - run: npx playwright install --with-deps chromium && npm run test:e2e   # smoke + axe against `vite preview` at the sub-path
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
```
- `needs: build` plus the test steps inside `build` means a failing test means no artifact and no deploy.
- Grant `pages: write`/`id-token: write` only to the deploy job (least privilege).
- Vite's guide uses `cancel-in-progress: true`. `false` avoids cancelling a deploy mid-flight; either is acceptable. This is a judgement call, not a verified best practice.
- The Playwright step adds about 1 minute. If that is too slow early on, put it in phase 1 as a single smoke test and grow it later.

### Sub-path pitfalls (each one has bitten Vite-on-Pages projects)

| Pitfall | Symptom | Prevention |
|---|---|---|
| Hard-coded root-absolute URLs in JS strings (`'/textures/chart.png'`, `fetch('/data.json')`) | Works in `vite dev`, 404 on Pages (resolves to `ainxtgendev.github.io/textures/…`) | Import assets (`import chartUrl from './chart.png'`) or use `new URL('./chart.png', import.meta.url)`. For `public/` files, use `` `${import.meta.env.BASE_URL}foo.png` ``. Vite only rewrites URLs it processes (HTML, CSS, imports), **not arbitrary JS strings**. |
| `base` case or typo mismatch | Blank page, every asset 404 | The repo path is case-sensitive: `/Eyeglass-Prescription/`. A Playwright smoke test against `vite preview` (which serves under `base`) catches this before deploy. |
| Client-side routes | Reload on `/Eyeglass-Prescription/compare` gives Pages 404 | Single page, no path routing. Put shareable state in `?query` or `#hash` (for example an encoded Rx), which also makes "share this comparison" free. |
| Missing trailing slash | `…/Eyeglass-Prescription` redirects; relative-path assumptions break | Always link to the trailing-slash URL; rely on `base`, not on relative `./` assumptions in JS. |
| Jekyll processing | Files starting with `_` disappear | Not applicable with an Actions artifact deploy (Jekyll does not run). `.nojekyll` is unnecessary but harmless (MEDIUM, from memory). |

### Caching and offline (service worker) under the sub-path

- **Origin is shared.** `ainxtgendev.github.io` hosts every Pages project of that account. `localStorage`, IndexedDB and Cache Storage are per *origin*, not per path. Namespace all keys (`eyeglass-rx:v1:…`). The service worker **scope must be `/Eyeglass-Prescription/`** so it never intercepts sibling projects.
- `vite-plugin-pwa` derives `scope`, `start_url` and the SW URL from Vite's `base`. Verify in the built `manifest.webmanifest` that `scope` and `start_url` are `/Eyeglass-Prescription/`. Register through the plugin's `virtual:pwa-register`, never with a hand-written `navigator.serviceWorker.register('/sw.js')` (wrong path and wrong scope).
- **Stale-app risk:** after a deploy, users keep running the old precached build until the new SW activates. Use `registerType: 'prompt'` with a visible "New version available – reload" toast. Using `autoUpdate` alone can swap the engine mid-session, which is bad when numbers change between versions. Show the app version or commit hash in the footer so bug reports and lens-critic checks can identify the build.
- GitHub Pages sets short HTTP cache lifetimes (about 10 min `max-age`, from memory; MEDIUM). Vite's content-hashed asset filenames make this safe. `index.html` and `sw.js` are the files that must revalidate, which Pages and Workbox handle.
- Precache only the app shell, the JS chunks and the eye-chart texture(s). Keep the precache small (target < 2 MB) for phones on metered data.
- Make the SW optional for phase 1 so it does not obscure base-path debugging. Add it in the phase that declares "works offline". A broken SW on a shared origin is the hardest thing to roll back. Keep `selfDestroying: true` (a vite-plugin-pwa option) as a documented kill switch.

---

## Installation

```bash
# Runtime
npm install --save-exact three@0.187.0

# Optional runtime (only if the hand-rolled store becomes insufficient)
npm install --save-exact @preact/signals-core@1.14.5

# Dev
npm install -D --save-exact vite@8.3.6 vitest@5.1.0 @vitest/coverage-v8@5.1.0 \
  fast-check@4.10.2 @playwright/test@1.65.0 @axe-core/playwright@4.14.0 \
  vite-plugin-pwa@2.0.0 eslint@10.14.0 @eslint/js@10.0.1 globals@17.14.0 \
  prettier@3.9.10 eslint-config-prettier@10.1.8
# optional: typescript@7.0.2 (checkJs on engine); jsdom@31.0.0 only if UI unit tests appear
```
Commit `package-lock.json`; CI uses `npm ci`. Add `"engines": { "node": ">=22.12" }`.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|---|---|---|
| WebGLRenderer + GLSL ShaderMaterial | WebGPURenderer + TSL (`three/webgpu`, `three/tsl`) | When the three.js manual drops "experimental" and target phones broadly have WebGPU. Possibly v2. The JS reference ray tracer makes the port low-risk. |
| Vanilla light-DOM HTML | Preact 11.1.1 + `@preact/signals` 2.11.4 (light DOM) | If the compare view or Expert panels become many dynamic lists with heavy re-render logic. Still native elements, no Shadow DOM. |
| Vanilla light-DOM HTML | Lit 3.3.3 | Only with `createRenderRoot() { return this; }` (light DOM). Default Lit shadow roots break label/ARIA wiring. |
| Vitest | `node:test` (built-in) | For a zero-dependency engine package. You lose Vite integration, `bench`, and nicer float matchers. Not worth it. |
| Custom `t()` | i18next | More than 2 locales with translators using a TMS, or complex ICU plurals. |
| GLSL analytic ray trace | three-mesh-bvh 0.9.18 (BVH ray tracing on meshes) | Only if surfaces stop being analytic. Ours are analytic, so BVH is slower and less exact. |
| vite-plugin-pwa | Hand-written SW | Never for this project. Cache versioning bugs on a shared origin are costly. |
| lil-gui 0.21 | — | Developer-only debug panel at most. **Never** as the user-facing UI: not designed for lay users or screen readers. |

## What NOT to Use

| Avoid | Why | Use Instead |
|---|---|---|
| `parseFloat` / `Number()` on raw input | `parseFloat('-2,25') → -2`: silent wrong Rx | Custom `parseDiopter()` with explicit comma/sign handling and an error result |
| `<input type="number">` for Rx | Locale-dependent comma handling; spinner UX; values silently rejected | `type="text" inputmode="decimal"` + own validation |
| Shadow-DOM web components for form controls | Cross-root `label for`/`aria-describedby` broken; Reference Target not cross-browser yet | Light DOM |
| `three/examples/jsm/...` deep paths, CDN `<script>` imports, import maps from unpkg | Breaks offline, unpinned, mixes copies of three | `three` + `three/addons/...` via npm, bundled by Vite |
| Mixing `three` and `three/webgpu` imports | Two copies of core classes; `instanceof` failures | One entry point (`three`) |
| `computeVertexNormals()` across lens/edge seams | Smeared shading at the rim | Analytic normals; duplicated seam vertices |
| Recreating `BufferGeometry` per input event | GC stalls on phones | Reuse typed arrays; `needsUpdate`; optional Worker |
| `EffectComposer` post-processing | Extra full-screen passes cost phone GPU time, for no correctness gain | None needed |
| gh-pages npm package / `gh-pages` branch deploy | Legacy flow; no test gate in the same pipeline; extra token handling | Official Actions artifact deploy |
| Root-absolute URLs in JS | 404 under `/Eyeglass-Prescription/` | Imports, `import.meta.url`, `BASE_URL` |
| Heatmap with rainbow/jet palette or colour-only meaning | Not colour-blind safe; violates "not by color alone" | viridis/cividis + legend + numeric callouts |

## Stack Patterns by Variant

**If re-mesh exceeds about 16 ms on the reference phone:** move `engine.compute()` into a module Worker and transfer the typed arrays. Lower the ring/spoke resolution while dragging and refine on idle.

**If the transmission pass is too slow on phones:** `transmissionResolutionScale = 0.5`, pixel ratio capped at 1.5–2, render on demand (only on control change or damping) instead of a constant loop.

**If WebGL2 context creation fails:** show a static 2D fallback (SVG cross-section + numbers). The core value (correct numbers) must not depend on the GPU.

## Version Compatibility

| Package A | Compatible With | Notes |
|---|---|---|
| vitest@5.1.0 | vite ^6.4 \|\| ^7 \|\| ^8; Node ^22.12 \|\| ^24 \|\| >=26 | Verified via `npm view vitest peerDependencies engines` |
| @vitest/coverage-v8@5.1.0 | vitest@5.1.0 exactly | Peer-pinned |
| vite@8.3.6 | Node ^20.19 \|\| >=22.12 | ESM-only; Rolldown bundler |
| vite-plugin-pwa@2.0.0 | vite ^3…^8; workbox 7.4.1; Node >=20.19 | Verified peer range |
| @axe-core/playwright@4.14.0 | Node >=22.12; any playwright-core | |
| eslint@10.14.0 | Node ^20.19 \|\| ^22.13 \|\| >=24 | Flat config only |
| three@0.187.0 | @types/three@0.187.0 (if editor types wanted) | Pin both together; WebGL2 required (WebGL1 support removed years ago; from memory) |
| Local Node v22.17.0 | all of the above | Verified `node --version` |

## Sources

- npm registry, queried 2026-11-06 via `npm view <pkg> version|engines|peerDependencies|time`: three, vite, vitest, @vitest/coverage-v8, vite-plugin-pwa, workbox-*, lit, preact, @preact/signals(-core), eslint, prettier, playwright, axe-core, fast-check, typescript, three-mesh-bvh. HIGH.
- Context7 `/mrdoob/three.js`: WebGPURenderer manual (experimental status, no ShaderMaterial/onBeforeCompile, `forceWebGL`, WebGL2 fallback); MeshPhysicalMaterial `transmission`/`thickness`; `WebGLRenderer.transmissionResolutionScale`; OrbitControls import, touches, damping, `listenToKeyEvents`. HIGH.
- https://github.com/mrdoob/three.js/releases: r185–r187 notes (r187 2026-10-30; removal of r177 deprecations; no WebGLRenderer deprecation). HIGH.
- https://vite.dev/guide/static-deploy: GitHub Pages `base`, "Source: GitHub Actions", workflow with SHA-pinned actions. HIGH.
- https://vite.dev/blog/announcing-vite8: Rolldown, Node 20.19+/22.12+. HIGH.
- https://vitest.dev/blog/vitest-5: Node 22.12+, projects inherit config, `clearMocks` default, bench changes. HIGH.
- `gh api repos/actions/{checkout,setup-node,configure-pages,upload-pages-artifact,deploy-pages}/releases/latest` and `/commits/<tag>`: versions and SHAs. HIGH.
- `gh api repos/AINxtGenDev/Eyeglass-Prescription` (+ `/pages` → 404): repo public, Pages not enabled. HIGH.
- [web.dev: WebGPU is now supported in major browsers](https://web.dev/blog/webgpu-supported-major-browsers): Safari/iOS 26, Chrome Android 121+ (Android 12+, Qualcomm/ARM), Firefox Android in progress. MEDIUM (article dated 2025-11).
- [Blink Intent to Ship: Reference Target](https://groups.google.com/a/chromium.org/g/blink-dev/c/eBx3sXIfJnw/m/jkZ6h9AkAAAJ), [Nolan Lawson on cross-root ARIA](https://nolanlawson.com/2022/11/), [Mozilla bug 1913371](https://bugzilla.mozilla.org/show_bug.cgi?id=1913371): Shadow DOM ARIA limitation and fix status. MEDIUM for the limitation, LOW for cross-browser fix status.
- TS 7 JSDoc changes: [developersdigest migration guide](https://developersdigest.tech/blog/typescript-7-native-compiler-migration-guide), [Visual Studio Magazine](https://visualstudiomagazine.com/articles/2025/12/02/microsoft-gets-real-on-native-typescript-remake.aspx). LOW–MEDIUM; verify against official TS release notes if typecheck is adopted.
- From memory, unverified: GitHub Pages `max-age` ≈ 600 s; `configure-pages` enablement needing an admin token; Jekyll not running for artifact deploys; Node 22 EOL date.

---
*Stack research for: browser-based 3D eyeglass lens & frame simulator*
*Researched: 2026-11-06*
