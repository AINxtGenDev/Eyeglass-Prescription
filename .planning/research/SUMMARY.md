# Research Summary — Eyeglass Prescription 3D Lens & Frame Simulator

**Researched:** 2026-11-06
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md (this folder); computation scripts in `scripts/` (calc.py, w.py)
**Overall confidence:** MEDIUM-HIGH

## User Overrides (take precedence over research)

1. **GitHub Pages from Phase 1** — Actions workflow build → test → deploy, Vite `base: '/Eyeglass-Prescription/'`. Overrides ARCHITECTURE.md's "deploy last". Pages is not yet enabled on the repo (`has_pages: false`); user pre-authorized enabling it (Source: GitHub Actions) once phase 1 is ready. Only the offline service worker may come later.
2. **German-only UI (de-AT) in v1** — the dictionary is `de-AT.js` from the first string. Overrides STACK.md's `en.js` and FEATURES.md's "German in v1.x".
3. **`lens-critic`** reviews every phase plan and every phase result.
4. **Coarse granularity** → 4 phases.
5. PITFALLS.md numbers come from `scripts/calc.py` and `scripts/w.py`; Phase 1 re-derives them as engine unit tests.

## Executive Summary

A "functional core, imperative shell" product: a pure-JS optics engine (Node-tested) produces every number; Three.js, SVG and the German DOM UI only display it. No public tool combines a paper-shaped Rx form, per-point geometry with frame shape and decentration, and comparisons in absolute mm and g — correctness plus explanation is the differentiator, 3D is the payoff.

## Recommended Stack

- Vite 8.3.6; vanilla light-DOM UI (no Shadow DOM — breaks `label for` / `aria-describedby`); `three@0.187.0` with `WebGLRenderer` (WebGPURenderer still experimental).
- Vitest 5.1.0, fast-check (property tests), `@playwright/test` 1.65.0, `@axe-core/playwright` 4.14.0; ESLint 10 with a rule forbidding `three`/DOM imports in the engine.
- SHA-pinned GitHub Actions: checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5.
- Inputs `type="text" inputmode="decimal"` + own parser (`parseFloat("-2,25") === -2`).
- Ring mesh with fixed topology, updated in place, analytic normals from the engine.
- i18n: flat dictionary + `t(key, params)`; numbers via `Intl.NumberFormat("de-AT")` (beware NBSP thousands separator and "-0").

## Top Pitfalls

1. **Vogel's rule** breaks at range extremes (SE −12 → D1 = 0; +12 in 62×55 frame impossible) and is far steeper than real high-index lenses (Zeiss 1.74 at −6: ≈1.20 D vs Vogel 3.00 D). Work in curvature; clamp D1; detect impossible lenses.
2. **Thin-lens D2 = D − D1** error for plus lenses: +0.26 D at +4, ~+1 D at +8, +3.3 D at +12 (CR-39). Use thick-lens form with fixed-point CT loop and a back-vertex-power round-trip test.
3. **Manufacturer curves are in 1.530 tool index** — store true ne per material (1.502 / 1.590 / 1.598 / 1.664 / 1.738) and convert fixtures.
4. **Sign / TABO / eye mirroring drift** — one `conventions.js`, signed `D2 = (1−n)/R2`, never mirror the left lens via `scale.x = −1`; invariant tests.
5. **Single global min CT distorts material comparison** — use sourced per-material minimums (Zeiss: 1.8 mm CR-39, 1.2 mm 1.67, 1.1 mm 1.74).
6. Toric model: meridional-radius approximation differs from a true torus by 0.10–0.39 mm at CYL −6, r = 30 mm → use true torus.
7. Naive sag formula loses precision near plano in float32 → use the rationalized form `s = c r² / (1 + √(1 − c² r²))`.
8. `MeshPhysicalMaterial` transmission refracts once at the front surface, single scalar thickness, can't see one transmissive lens through another → label "visual impression".

Densities confirmed (Zeiss 6/23 sheets): 1.32 / 1.20 / 1.30 / 1.35 / 1.47 g/cm³.

## Suggested Phases (coarse)

1. **Foundation: engine, validation, live pipeline** — Vite scaffold, CI + Pages deploy with Playwright smoke at the sub-path, minimal live German page (disclaimer + numeric result); parser incl. plus-cyl transposition; materials with sources; frame outlines; full engine (true torus, thick-lens fixed point, CT solve, decentration, metrics); ray-trace test oracle; tiered golden tests; frozen `LensResult` contract. Deep research needed.
2. **Lay-first German UI & comparison (core value)** — paper-shaped Rx table, validation, presets, tap explanations, missing-PD handling, frame-stamp helper, Simple-view headline, mm/g material & frame comparison, SVG cross-section with A/B overlay, accessibility, 320 px German layout. Standard patterns.
3. **3D lens & frame + Expert view** — real-device benchmark first, ring mesh, frame, camera presets, baseline transmission, heatmap with legend + callouts, Expert panel. Moderate research.
4. **Refraction impression, offline & hardening** — CPU warp-grid accurate refraction view from engine surfaces, PWA with prompt-to-update + kill switch, full a11y audit, performance pass. Moderate research.

## Resolved Conflicts

| Topic | Options | Resolution |
|---|---|---|
| Accurate refraction | GLSL shader (STACK) vs CPU warp grid (ARCH) | CPU warp grid — single source of truth, Node-testable, avoids mobile float precision |
| Shareable URL | hash link (FEATURES) vs privacy warning (PITFALLS) | Deferred to v1.x, opt-in only |
| Min-thickness defaults | global 1.5/1.2 mm (PROJECT) vs per-material (PITFALLS) | Per-material sourced defaults; update PROJECT.md |
| Engine folder | `src/domain/` vs `src/engine/` | `src/engine/` with lint boundary rule |

## Gaps

- No citable conic constants for real aspheric lenses (proprietary) → aspheric is a parametric model, fixtures are sanity checks only.
- Textbook worked examples (Jalie; Brooks & Borish) not accessible; ISO 8980-1 tolerances paywalled.
- Phone performance extrapolated (desktop 0.49 ms/lens), must be measured.
- Unverified: iOS decimal keypad minus key; German hyphenation support; Austrian terms (Basiskurve vs Durchbiegung); frequency of plus-cyl and missing PD on Austrian Rx.

## Confidence

| Area | Level |
|---|---|
| Stack | HIGH |
| Features | MEDIUM |
| Architecture | MEDIUM-HIGH |
| Pitfalls | MEDIUM-HIGH (Zeiss data HIGH, textbook refs LOW) |
