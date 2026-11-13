---
phase: 04-refraction-view-offline
verified: 2026-11-13T23:32:43Z
status: human_needed
score: 2/4 roadmap success criteria fully verified in code (SC1, SC3 code side); SC2 and SC4 need a human or a pending gate result; 0 failed
overrides_applied: 1
overrides:
  - must_have: "a cylinder visibly distorts along the correct axis"
    reason: "D-02 reinterpretation: the Durchblick shows the central 30° field, so the cylinder effect is judged by the Mit/Ohne Glas blink, the reference ticks and the size text, with on-screen pixel tests for axis direction and eye swap as the hard gate (04-08 M3)"
    accepted_by: "user"
    accepted_at: "2026-11-13 (session.md line 57)"
human_verification:
  - test: "Real mid-range phone (F-05 / SC2, 04-13 Task 3): open the live site after the push, switch to Durchblick, edit the Rx several times including a strong plus lens and a small frame"
    expected: "Pictures arrive without freezing, or the badge changes to 'Durchblick · vereinfacht' with the grey degraded note; ENG-09 (a)-(d) on the phone"
    why_human: "Needs a real phone GPU/CPU; SwiftShader and the 4x CPU proxy do not throttle the worker"
  - test: "Live site offline check (04-13 Task 3): visit https://ainxtgendev.github.io/Eyeglass-Prescription/ once, go offline, reload, edit the Rx, open Durchblick"
    expected: "Page loads from the service worker, results recompute, Durchblick renders; SW scope is /Eyeglass-Prescription/; verify-live test:pwa:live green"
    why_human: "Nothing is pushed yet; the live origin and real deploy cannot be checked locally"
  - test: "Update prompt on the live site after a second deploy"
    expected: "'Neue Version verfügbar' banner with 'Aktualisieren' / 'Später'; no mid-session switch; inputs survive 'Aktualisieren'"
    why_human: "Requires two real deploys on the shared origin"
  - test: "Visual judgement of SC1 in a real browser with a real GPU: −4,00 minifies, +4,00 magnifies, −2,00 / −2,00 × 30 shears along the mirrored axis, Mit/Ohne blink"
    expected: "Effect visible and understandable for a lay user"
    why_human: "Pixel tests prove direction; perceptibility for a lay user is a human call"
  - test: "lens-critic phase-result review (SC4)"
    expected: "Verdict PASS, or the user explicitly accepts the open findings (BENCH_GATE budgets, ReadPixels warning, rim stripe contrast at 1164 px, 89 MB chart texture, others in 04-13-SUMMARY 'Open findings')"
    why_human: "Result review is running separately; 04-13-SUMMARY still reads 'lens-critic verdict: inserted by orchestrator'"
  - test: "Push decision (04-13 Task 2), including the local-history privacy item"
    expected: "User approves the push; decides whether to rewrite local commits cf93dd8 and 387d7b1 that still contain a sibling site's custom domain (a personal name)"
    why_human: "Outward-facing and irreversible; needs explicit user approval"
---

# Phase 4: Refraction View & Offline Verification Report

**Phase Goal:** Users can look "through" their lens and see a physically traced impression of minification, magnification and cylinder distortion, and the site keeps working offline after the first visit.
**Verified:** 2026-11-13T23:32:43Z (local 2026-11-14)
**Status:** human_needed
**Re-verification:** No, initial verification

Scope note: HEAD a6c8e4d, 112 local commits ahead of origin/main, nothing pushed. dist/ on disk was built from d07e16d (later commits are docs only). The verifier did not run e2e or start servers (another review holds ports 4173-4175/4180); e2e results below are the executor's 04-13 gate and are marked as such.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1 / REF-01: Durchblick shows the chart traced through the engine's actual front and back surfaces; minus minifies, plus magnifies, cylinder distorts along the correct axis | VERIFIED (cylinder part: PASSED via override D-02) | `src/engine/warp.js` imports `traceFromEye` from `src/engine/trace.js`, which uses `frontSagAt/backSagAt` + gradients from `design.js` (the engine surfaces, Newton + vector Snell). `ref-mode.js:130-132` feeds `inputs.eyes[eye].result.surfaces` (or compare A/B surfaces) to the warp worker (`ref-mode.js:353`, `warp.worker.js` → `warp-protocol.js` → `prepareWarp/warpGrid`). `refraction.js` writes the traced object tangents into the `uv` attribute of the chart mesh (no GLSL optics). Verifier spot check with the engine (scratchpad `spot.mjs`): −4,00 → angular magnification 0,9439, +4,00 → 1,0777, 0/−2×90 → horizontal 0,9714 / vertical 1,0006, 0/−2×180 → the reverse. Correct signs and meridians. `warp.test.js` "wearer-view axis golden": axis meridian at φ = 180° − θ for OD and OS (mirror of TABO for the wearer, correct). 322/322 unit tests in 12 phase-4 files pass (verifier run). M3 on-screen pixel gate exists in `e2e/view-ref.spec.js:504-591` (executor gate: 53/0) |
| 2 | SC2 / REF-02: on a mid-range phone the view runs acceptably or drops to lower resolution with a visible note | UNCERTAIN (code VERIFIED, phone pending) | `src/state/guard.js` `nextGuard` (200 ms, two in a row → one tier down), wired at `ref-mode.js:633-662`: sets `degraded`, shows `#view-ref-degraded` with `view.ref.degraded`, badge `Durchblick · vereinfacht`, live-region text once; phone start tier `mittel` (`tiers.js refStartTier`). Real-phone behaviour is 04-13 Task 3 (F-05) |
| 3 | SC3 / OFF-01: after one visit the site loads and computes offline; new version → "Aktualisieren" prompt, no mid-session switch; SW scoped to `/Eyeglass-Prescription/` | VERIFIED (local build); live check pending | `dist/manifest.webmanifest` scope and start_url `/Eyeglass-Prescription/`; `dist/assets/update-*.js` registers `new Workbox('/Eyeglass-Prescription/sw.js', {scope:'/Eyeglass-Prescription/'})` via `virtual:pwa-register` (`src/ui/update.js:15`); `vite.config.js` `registerType: 'prompt'`, `skipWaiting: false`, `clientsClaim: true`; `dist/sw.js` skips waiting only on a `SKIP_WAITING` message; precache includes index, all chunks and the warp/mesh/engine workers (1,0 MB). Banner copy `update.apply: 'Aktualisieren'`; handover in `src/ui/handover.js`. `e2e/pwa.spec.js` item 17 reloads offline, asserts `fromServiceWorker()`, recomputes thickness and renders Durchblick with the worker from the precache. `SW_SELF_DESTROY = false`. No test hooks (`__eyeglassView`, `refdegraded`, `refguardoff`) in dist |
| 4 | SC4: lens-critic reviewed the plan and the result with PASS, or the user accepted the findings | UNCERTAIN (plan PASS verified; result review pending) | Plan review PASS in round 5 (`04-LENS-CRITIC-R5.md`). No result-review record exists in the phase dir; `04-13-SUMMARY.md:29` reads "lens-critic verdict: inserted by orchestrator" |

**Score:** 2/4 truths verified, 2 uncertain (human / pending gate), 0 failed.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/engine/trace.js` (`traceFromEye`) | Non-throwing reverse trace through real surfaces | VERIFIED | Reuses the ENG-08 Newton/Snell cores |
| `src/engine/magnification.js` | Spectacle magnification, eye point 15 mm | VERIFIED | `EYE_POINT_MM`, Le Grand 3,04 mm test |
| `src/engine/warp.js` | Warp grid, aperture classes, tiers | VERIFIED | Pure JS, no DOM/Three imports |
| `src/state/warp-client.js`, `warp-protocol.js`, `src/worker/warp.worker.js` | Worker lane, latest wins, sync fallback | VERIFIED | Wired from `ref-mode.js` |
| `src/ui/view/ref-mode.js`, `refraction.js`, `ref-layout.js`, `ref-size.js` | Durchblick mode, rendering, size text | VERIFIED | Imported in `view.js:125-126`, created at `view.js:1296` |
| `src/state/guard.js`, `src/ui/view/tiers.js` | Degradation | VERIFIED | Wired at `ref-mode.js:633` |
| `vite.config.js` VitePWA, `src/ui/sw-core.js`, `src/ui/update.js`, `src/ui/handover.js`, `sw-kill-switch.js` | Offline, prompt, handover, kill switch | VERIFIED | Lazy-imported from `main.js:299` after first paint |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `ref-mode.js` | engine LensResult surfaces | `warpSource()` reads `inputs.eyes[eye].result.surfaces` | WIRED |
| `ref-mode.js` | `warp.worker.js` | `new Worker(new URL(...))` + `createWarpClient` | WIRED |
| `warp-protocol.js` | `warp.js` | `prepareWarp`, `warpGrid` | WIRED |
| `warp.js` | `trace.js` | `traceFromEye` | WIRED |
| warp reply | chart mesh | `refraction.js` writes object tan into `uv` | WIRED |
| `main.js` | `update.js` → `virtual:pwa-register` | dynamic import after first paint | WIRED |
| `update.js` | `handover.js` | snapshot before reload, `takeHandover` at load | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| Durchblick picture | uv per grid point | worker `warpGrid` over the current Rx's `LensResult.surfaces` | Yes (spot check reproduces 6 % / 8 % values shown in the UI) | FLOWING |
| Size block | `refBlockFor` / `refSizeBlock` | `LensResult.magnification.meridians` | Yes | FLOWING |

### Behavioral Spot-Checks (verifier's own runs)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase-4 unit tests | `npx vitest run` on 12 files (magnification, trace, warp, outline-geom, guard, warp-client, warp-protocol, sw-core, handover, tiers, text, ref-layout) | 322 passed, 0 failed | PASS |
| Minus minifies / plus magnifies / cylinder meridian | `node scratchpad/spot.mjs` | 0,9439 / 1,0777 / 0,9714 horizontal for axis 90 | PASS |
| SW scope and manifest in build | read `dist/manifest.webmanifest`, `dist/assets/update-*.js` | `/Eyeglass-Prescription/` everywhere | PASS |
| Node time budgets | `BENCH_GATE=1 npx vitest run test/bench/warp-tiers.test.js` (load 0,3) | 3 failed / 4 passed: combined medians fein 57,3, mittel 17,1, grob 12,7 ms vs 30 / 15 / 8 | FAIL (warning: local-only gate, not in CI; mitigated by step-down) |
| e2e (view-ref, pwa, live subset) | not run by the verifier (port constraint) | executor 04-13 gate: 684 passed / 0 failed; pwa 20/0; live 323 | SKIP (executor evidence only) |

### Probe Execution

Step 7c: no `scripts/*/tests/probe-*.sh` declared or present for this phase. SKIPPED.

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|-------------|--------------|--------|----------|
| REF-01 | 9 plans | SATISFIED (with D-02 override) | Truth 1 |
| REF-02 | 5 plans | NEEDS HUMAN | Truth 2: mechanism present, phone pending |
| OFF-01 | 8 plans | SATISFIED locally, live pending | Truth 3 |

No orphaned requirements: REQUIREMENTS.md maps only REF-01, REF-02, OFF-01 to phase 4, all claimed by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `test/dist/parity.test.js` | 151-157 | `XXXXXXXX` | Info | Hash placeholder in fixture filenames, not a debt marker |
| production `src/` (phase-4 files) | - | TBD/FIXME/XXX/TODO/HACK | none found | - |
| `test/bench/warp-tiers.test.js` | - | timing budgets red under BENCH_GATE=1 | Warning | REF-02 Node budget missed on the Grenzfall Rx; ray gates pass; 04-VALIDATION `nyquist_compliant: false` |
| local git history | cf93dd8, 387d7b1 | sibling site's custom domain (personal name) in a code comment | Warning | Removed from files (fee39c5) but still in unpushed history; decide before push |
| deferred-items.md | - | seven older query switches ship in production | Info | Out of scope, recorded |

### Human Verification Required

1. **Real mid-range phone (F-05 / SC2).** Live site, Durchblick, repeated edits incl. +10,75 / −1,00 × 89 in 43×43. Expected: no freeze, or "Durchblick · vereinfacht" with the note; ENG-09 on the phone. Why human: real GPU/CPU.
2. **Live offline check.** Visit once, go offline, reload, edit, open Durchblick; SW scope `/Eyeglass-Prescription/`; verify-live `test:pwa:live`. Why human: nothing deployed yet.
3. **Update prompt live.** After a second deploy: "Aktualisieren" / "Später" banner, inputs kept. Why human: needs two real deploys.
4. **SC1 visual judgement on a real GPU.** Effects visible to a lay user (pixel tests prove direction only).
5. **lens-critic result verdict (SC4).** Running separately; PASS or user acceptance of the 16 open findings in 04-13-SUMMARY.
6. **Push approval (04-13 Task 2)** incl. the history decision on cf93dd8 / 387d7b1.

### Gaps Summary

No must-have is FAILED. The Durchblick is a real CPU ray-traced warp grid on the engine's own surfaces, wired end to end, and its signs and axis match an independent engine spot check. Offline packaging, prompt-mode update and scope are correct in the built artifact. What remains is outside the local codebase: the real-phone run, the live deploy checks, the lens-critic result verdict and the push decision. The thing most likely to bite: BENCH_GATE time budgets are red on the Grenzfall prescription (reproduced here at low load), so on slow phones strong plus lenses in small frames will depend on the automatic step-down; the phone check decides whether that is "acceptable".

---

_Verified: 2026-11-13T23:32:43Z_
_Verifier: Claude (gsd-verifier)_
