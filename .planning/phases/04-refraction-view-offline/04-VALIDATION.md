---
phase: 4
slug: refraction-view-offline
status: executed (04-13 Task 1)
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-13
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `04-RESEARCH.md` § Validation Architecture. Task IDs filled by the planner (2026-11-13); updated in plan revision 1 (lens-critic round 1, plan-checker): 04-07 split into 04-07 + 04-14, 04-02 split into 04-02 + 04-15, waves renumbered 1–9; updated in plan revision 2 (lens-critic round 2, NEW-1 … NEW-10): rows 04-01-T3, 04-02-T1, 04-03-T1/T2/T3, 04-04-T1/T2, 04-05-T3, 04-06-T2, 04-08-T1/T2/T3, 04-10-T2, 04-11-T1, 04-12-T2, 04-13-T1, 04-14-T1/T2/T3 and the D-02 manual row; updated in plan revision 4 (lens-critic round 4, NEW-11b, NEW-12, NEW-14, H, I): rows 04-02-T1, 04-05-T2, 04-08-T1/T3, 04-10-T2, 04-11-T1, 04-14-T3.
> `nyquist_compliant` and `wave_0_complete` stay `false` until 04-13 Task 1 finds every row green (lens-critic MINOR 10).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.1.0 (projects `unit` and, from 04-02, `dist`; node env) + fast-check 4.10.2; Playwright 1.65.0 + @axe-core/playwright 4.14.0; chrome-devtools MCP for live checks at phone size |
| **Config file** | `vite.config.js` (`test.projects`; from 04-04 `SW_KILL` → `selfDestroying` and `define __SW_KILL__`), `playwright.config.js` (from 04-02 every webServer has `reuseExistingServer: false`, NEW-5; from 04-06: `desktop`/`mobile` with `serviceWorkers: 'block'`, new `pwa` project with `serviceWorkers: 'allow'`, `fullyParallel: false`, one spec file, on the production build via `e2e/support/switch-server.js`; `@live` tests run by `npm run test:pwa:live`); `sw-kill-switch.js` (the kill-switch flag and `swKillEffective(env)`, the one effective expression the build, the app and the tests read, NEW-1) |
| **Quick run command** | `npx vitest run --project unit src/engine/warp.test.js src/engine/magnification.test.js src/engine/trace.test.js` |
| **Full suite command** | `npm run lint && npm run test:coverage && npm run build && npm run build:e2e && npm run test:e2e && npm run test:e2e:live && npm run test:dist && npm run test:pwa:live` |
| **Estimated runtime** | not measured yet; 04-02 records it after the CI split |

---

## Sampling Rate

- **After every task commit:** the quick run command, plus the affected Vitest files and only the affected Playwright spec files (memory `targeted-e2e-before-push`).
- **After every plan wave:** `npm run test:coverage`, `npm run build`, `npm run build:e2e`, `npm run test:dist` and the affected Playwright projects.
- **Before `/gsd-verify-work`:** the full suite green in CI (with the e2e build split), the chrome-devtools MCP screenshots listed in the UI-SPEC, and the lens-critic result review (04-13).
- **Max feedback latency:** 120 seconds for the quick command (carried over from phase 3); P0 (04-03 Task 3), the pwa update tests and the kill-switch rehearsal (04-14) are known long runs and are not per-commit. Build B and the kill build are built lazily by the pwa spec, so targeted desktop/mobile runs never pay for them.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 04-01 | 1 | REF-01 | T-04-01, T-04-03 | Reverse trace never throws; ENG-08 oracle unchanged; real tirFront case, synthetic n < 1 for tirBack (MINOR 3) | unit/property | `npx vitest run src/engine/trace.test.js` | ✅ (extend) | ✅ green at d07e16d |
| 04-01-T2 | 04-01 | 1 | REF-01 | T-04-02, T-04-05 | SM formula = trace Jacobian ≤ 0,05 pp both meridians (D-12 c/e); sign property (D-12 b, E3); 3,04 mm reproduced from the Le Grand table (MINOR 4); source line per M5 | unit/property | `npx vitest run src/engine/magnification.test.js src/engine/evaluate.test.js` | ❌ W0 (created in task) | ✅ green at d07e16d |
| 04-01-T3 | 04-01 | 1 | REF-01 | T-04-04 | Size sentences, direction words, notes (E4, N6, N7); rimPastNote rule, no "Prozentpunkt" (MINOR 8); cylSameNote wording (NEW-9) | unit | `npx vitest run src/i18n src/ui/view/text.test.js` | ✅ (extend) | ✅ green at d07e16d |
| 04-02-T1 | 04-02 | 1 | OFF-01, REF-01 | T-04-06, T-04-07 | No test hook in dist/ (E8); live subset hook-free; worker bundles identical and every other chunk identical except the whole-name allow-listed view chunk and the entry, compute-protocol and mesh-protocol chunks (warp-protocol pre-registered), whose content must be identical after normalising hashed chunk names; every allow-list entry except view-* must be normalisedEqual (M4, NEW-8, round-3 G, round-4 NEW-12); `import.meta.env` allow-list (M4); `reuseExistingServer: false` (NEW-5) | build test + unit | `npm run build && npm run build:e2e && npm run test:dist && npx vitest run test/ci && npm run test:e2e:live` | ❌ W0 (created in task) | ✅ green at d07e16d |
| 04-02-T2 | 04-02 | 1 | OFF-01 | T-04-09 | CI order and no-bypass structure | unit | `npx vitest run test/ci` | ✅ (extend) | ✅ green at d07e16d |
| 04-03-T1 | 04-03 | 2 | REF-01 | T-04-10, T-04-11 | Identity (D-12 a), aperture classes E9 in tan units, wearer-view axis golden (D-12 d, D-07), no NaN (D-12 f), real class-3 case; effectiveLeafPx non-decreasing fein → mittel → grob ≤ 2·√2 (NEW-2) | unit/property | `npx vitest run src/engine/outline-geom.test.js src/engine/warp.test.js` | ❌ W0 (created in task) | ✅ green at d07e16d |
| 04-03-T2 | 04-03 | 2 | REF-01, REF-02 | T-04-12 | DRAWN triangle interpolant ≤ 0,5 px at the panel edge (MINOR 1; ≤ 0,45 px for the P0-fixed tiers, NEW-4), class boundary ≤ 2 px per tier at the real leaf (N10, M2); E10 visibility; rimInField/pastRimInField; rays, monotonic on the item-12 frame (NEW-2) | unit | `npx vitest run src/engine/warp.test.js -t "N10\|E10\|warp grid"` | ❌ W0 | ✅ green at d07e16d |
| 04-03-T3 | 04-03 | 2 | REF-01, REF-02 | T-04-13, T-04-13b | Measured stage sizes; P0 G1/G2 criteria 1–5 (E1), timing/ray table with leaf sweep, grob chosen with ≤ 0,45 px headroom (NEW-4), E10 pinned to measurements (MINOR 2; stage sizes measured on a server whose port was free and whose served commit = HEAD, round-3 C), provisional grob cell 10 / leafPx 3 before P0 (round-3 note), CI subset, ray-count gate rays(grob) ≤ rays(mittel) ≤ rays(fein) at both item-12 panels (M2, NEW-2); UI-SPEC "Open for the user" line updated (NEW-10) | script + unit | `node scripts/p0-feasibility.mjs > /dev/null && npx vitest run src/engine/warp.test.js -t "P0 CI subset\|ray-count gate"` | ❌ W0 | ✅ vitest part at HEAD (P0 CI subset + ray-count gate in test:coverage); P0 script not re-run (engine trace unchanged since cebd643) |
| 04-04-T1 | 04-04 | 2 | OFF-01 | T-04-SC, T-04-15, T-04-16 | Exact pins after slopcheck; `npm audit --omit=dev` = 0; kill switch = one flag + one effective expression feeding selfDestroying and `define __SW_KILL__` (M1, NEW-1); steps/duration/re-enable and every 'kill switch on' skip documented | unit + CLI | `npx vitest run test/ci/pins.test.js && npm audit --omit=dev && npm run build` | ✅ (extend) | ✅ green at d07e16d |
| 04-04-T2 | 04-04 | 2 | OFF-01 | T-04-14, T-04-17 | Manifest scope/start_url `/Eyeglass-Prescription/`; flag-aware worker shape via swKillEffective(process.env) (normal or destroyer, M1, NEW-1); precache covers every chunk and worker, < 2 MB; CSP meta unchanged | build test | `npm run build && npm run build:e2e && npm run test:dist` | ❌ W0 (created in task) | ✅ green at d07e16d |
| 04-15-T1 | 04-15 | 2 | OFF-01 | T-04-08, T-04-08b | Flaky tests listed in the job summary (F-01) | unit | `npx vitest run test/ci/flaky-reporter.test.js` | ❌ W0 (created in task) | ✅ green at d07e16d |
| 04-15-T2 | 04-15 | 2 | OFF-01 | T-04-08 | Race test at retries 0 (F-01); a11y "everything open" 90 s (F-03) | e2e | `npx playwright test e2e/a11y.spec.js --workers=4 -g "everything open" && npx playwright test e2e/worker.spec.js -g "never-happens"` | ✅ (extend) | ✅ green at d07e16d |
| 04-05-T1 | 04-05 | 3 | REF-02 | — | `nextGuard` slow-fast-slow, slow-slow, slow-(excluded)-slow, grob (E5) | unit | `npx vitest run src/state/guard.test.js` | ❌ W0 | ✅ green at d07e16d |
| 04-05-T2 | 04-05 | 3 | REF-01 | T-04-18, T-04-19, T-04-20 | Warp handler validates and never throws; tier leafPx passed through; latest-wins, watchdog, cancel; parity.test.js already holds the whole-name normalisedEqual warp-protocol entry (read-only check, round-4 NEW-12) | unit | `npx vitest run src/state/warp-protocol.test.js src/state/warp-client.test.js` | ❌ W0 | ✅ green at d07e16d |
| 04-05-T3 | 04-05 | 3 | REF-02 | — | Per-tier bench (E6) incl. the item-12 rim case (M2); monotonic ray rule always asserted (NEW-2); timing gate only with BENCH_GATE=1 | bench | `BENCH_GATE=1 npx vitest run test/bench/warp-tiers.test.js` | ❌ W0 | ❌ BENCH_GATE=1 exit 1: Grenzfall budget medians fail (fein 57,0 / mittel 17,1 / grob 12,8 ms vs 30 / 15 / 8); ray-count and monotonic gates pass; known since 04-05, for lens-critic |
| 04-06-T1 | 04-06 | 3 | OFF-01 | T-04-21, T-04-23 | Registration only via virtual:pwa-register, after first paint/idle; offline line priority | unit | `npx vitest run src/ui/sw-core.test.js src/engine/boundary.test.js` | ❌ W0 | ✅ green at d07e16d |
| 04-06-T2 | 04-06 | 3 | OFF-01 | T-04-21, T-04-22, T-04-24, T-04-24b, T-04-25 | Offline reload computes + 3D (fromServiceWorker, route abort); runtime scope; N12; CSP with the worker active; @live tests in verify-live (M4); serial pwa project (MINOR 9); every worker-dependent test skips on KILL (NEW-1); switch server `reuseExistingServer: false` (NEW-5) | e2e (`pwa`) + unit | `npm run build && npx playwright test --project=pwa && npm run test:pwa:live && npx vitest run test/ci` | ❌ W0 | ✅ green at d07e16d |
| 04-07-T1 | 04-07 | 4 | OFF-01 | T-04-26, T-04-27 | Storage allow-list: only `handover.js`, one key (E7); read-and-delete, size cap, validated restore | unit | `npx vitest run src/ui/handover.test.js src/engine/boundary.test.js` | ✅ amend / ❌ W0 | ✅ green at d07e16d |
| 04-07-T2 | 04-07 | 4 | OFF-01 | T-04-28, T-04-29 | controllerchange rule incl. the first-visit tab (N8, MINOR 5); idempotent reload; probe; 10 s failure | unit | `npx vitest run src/ui/sw-core.test.js` | ✅ (extend) | ✅ green at d07e16d |
| 04-08-T1 | 04-08 | 4 | REF-01 | — | Panel geometry, gridTriangles = CELL_DIAGONAL; every Durchblick e2e RED incl. M3 with the NEW-3 geometry (inscribed-square lower windows, off-centre rows, 1280×800, skipped on mobile); M3 (a) division-free Node oracle at the 1280×800 panel size over the non-empty clean point set of a 2 px lattice (≥ 1,5 px from every checker edge at eye and object direction): LL_o ≥ 20, LR_o ≤ 0,25·LL_o, flipped/mirrored mappings fail the on-screen conditions (NEW-3, round-3 NEW-11, round-4 NEW-11b); live smoke listed (M4) | unit + e2e (Node oracle) | `npx vitest run src/ui/view/ref-layout.test.js test/ci/live-subset.test.js && npx playwright test e2e/view-ref.spec.js --project=desktop -g "M3 \(a\) oracle"` | ❌ W0 | ✅ green at d07e16d |
| 04-08-T2 | 04-08 | 4 | REF-01 | — | Mode switch, enter/leave (item 7); phase-3 view specs unaffected; tech.ref.formulaSource wording (NEW-9) | e2e | `npm run build:e2e && npx playwright test e2e/view-ref.spec.js -g "item 7" && npx playwright test e2e/view.spec.js e2e/view-heat.spec.js e2e/view-controls.spec.js` | ✅ (created in T1) | ✅ green at d07e16d |
| 04-08-T3 | 04-08 | 4 | REF-01 | T-04-31 … T-04-35c | Durchblick renders (items 1–9; item 1 checks a letter-band pixel above the panel centre in Ohne Glas, round-4 I); M3 on-screen gate (handle panel size = oracle panel size; LL_s ≥ 0,6·LL_o and LR_s ≤ LR_o + 0,2·LL_o for OD/OS with the oracle computed in the same test, round-3 NEW-11; screen and oracle count the same clean point set, round-4 NEW-11b; inward/outward off the centre row, y-asymmetric rim off the centre line; NEW-3); numbers never wait; one context; live smoke on dist; Durchblick offline (item 17) | e2e | `npm run build && npm run build:e2e && npx playwright test e2e/view-ref.spec.js e2e/ref-live.spec.js && npm run test:e2e:live && npx playwright test --project=pwa -g offline` | ✅ (created in T1) | ✅ green at d07e16d |
| 04-09-T1 | 04-09 | 5 | REF-01, REF-02 | T-04-37, T-04-38, T-04-39 | One-panel, blocked, failure, no-WebGL size block; stage visibility (items 10, 11, 13, 14) | unit + e2e | `npx vitest run src/ui/view/ref-layout.test.js && npx playwright test e2e/view-ref.spec.js` | ✅ (extend) | ✅ green at d07e16d |
| 04-09-T2 | 04-09 | 5 | REF-01 | T-04-36 | Rim in the field (item 12 in tan units), rimPastNote rule, ticks (item 25), no fill in the field (item 5) | e2e | `npx playwright test e2e/view-ref.spec.js` | ✅ (extend) | ✅ green at d07e16d |
| 04-10-T1 | 04-10 | 6 | REF-02 | — | Grid start tier; thumbnail guard on nextGuard (F-06) | unit + e2e | `npx vitest run src/ui/view/tiers.test.js && npx playwright test e2e/view-controls.spec.js` | ✅ (extend) | ✅ green at d07e16d |
| 04-10-T2 | 04-10 | 6 | REF-02 | T-04-40, T-04-41 | Degradation note, live text once, tech lines; step down cuts rays (M2), incl. the rim case starting at mittel on the mobile project with a frame chosen in Node so rimInField is true at the reported panel (lever: shape rund, then panto, at the minimum box; validateFrame accepts it and PD in RX_RANGES.pd), asserted in Node and in the reply before the step (NEW-2, round-3 D, round-4 NEW-14); degraded hook absent from dist/ and allow-listed in env-gates | e2e + build test + unit | `npm run test:dist && npx vitest run test/ci/env-gates.test.js && npx playwright test e2e/view-ref.spec.js && npx playwright test e2e/view-ref.spec.js --project=mobile -g "rim case from mittel"` | ✅ (extend) | ✅ green at d07e16d |
| 04-10-T2p | 04-10 | 6 | REF-02 | — | 4× throttled input → Durchblick paint (informational) | perf | `npm run test:perf` | ✅ (extend) | ✅ informational (test:perf 3/3) |
| 04-11-T1 | 04-11 | 7 | REF-01 | T-04-43 | A/B Durchblick for the compared eye (item 26); A = frame chosen in Node at the reported 1280×800 panel with ≥ 8 class-2/4 points (AB_FRAME_A; lever: shape rund, then panto, at the minimum box; validateFrame accepts it, round-4 NEW-14), B = default frame with no rim point: rim colour only in the left panel (NEW-7, round-3 E) | e2e | `npx playwright test e2e/view-ref.spec.js e2e/view-compare.spec.js` | ✅ (extend) | ✅ green at d07e16d |
| 04-11-T2 | 04-11 | 7 | REF-01 | T-04-44 | Leak test across mode switches, one WebGL context (item 16, D-14) | e2e | `npx playwright test e2e/view-memory.spec.js` | ✅ (extend) | ✅ green at d07e16d |
| 04-14-T1 | 04-14 | 7 | OFF-01 | T-04-28 | Controller wired to the plugin; banner; confirmation; no registration while `__SW_KILL__` is on (same value as selfDestroying, NEW-1) | unit + e2e (`pwa`) | `npx vitest run src/ui/sw-core.test.js src/ui/handover.test.js src/engine/boundary.test.js && npm run build && npx playwright test --project=pwa` | ✅ (extend) | ✅ green at d07e16d |
| 04-14-T2 | 04-14 | 7 | OFF-01 | T-04-28, T-04-29 | Update prompt, handover, four tabs, first-visit tab, Später, typing, failure, probe (items 19–24, 20b); switch describe skipped live and on KILL (NEW-1); file-level reset to build A (NEW-6); lazy build B | e2e (`pwa`) | `npm run build && npx playwright test --project=pwa && npm run test:pwa:live` | ✅ (extend) | ✅ green at d07e16d |
| 04-14-T3 | 04-14 | 7 | OFF-01 | T-04-52, T-04-53 | Kill-switch rehearsal both ways on production's no-registration path (registrations [], caches [], tech.offline.failed, ≤ 4 navigations counted up to the second reload, round-3 A; offline after re-enable); kill-active @live check (proves sw.js shape only); kill build passes the full gate with SW_SELF_DESTROY flipped (the full-suite command plus the pwa project, every command exits 0; every worker-dependent pwa test skipped, scope-and-manifest runs its manifest part; NEW-1 fix 3, round-3 B, round-4 H); sibling Cache Storage check recorded (M1) | e2e (`pwa`) + CLI | `npx playwright test --project=pwa -g "kill" && git diff --quiet sw-kill-switch.js && npm run build && npm run build:e2e && npm run test:dist && npx playwright test --project=pwa` (+ step 6a with the flag flipped: full-suite command + pwa project, output in the SUMMARY) | ✅ (extend) | ✅ rehearsal in pwa project at HEAD; flag-flipped kill gate evidence from 04-14 / 04-12 (not re-run at HEAD) |
| 04-12-T1 | 04-12 | 8 | REF-01 | T-04-45, T-04-46 | Fullscreen info panel (item 15), m4 low button | e2e | `npx playwright test e2e/view-fullscreen.spec.js e2e/view-heat.spec.js` | ✅ (extend) | ✅ green at d07e16d |
| 04-12-T2 | 04-12 | 8 | REF-01, OFF-01 | — | axe matrix and 320 px reflow for every new state (item 27); banner axe states inside the KILL-skipped describe, kill gate re-run as the full-suite command + pwa project with the flag flipped (NEW-1, round-3 B) | e2e | `npx playwright test e2e/a11y.spec.js && npx playwright test --project=pwa` | ✅ (extend) | ✅ (pwa project at HEAD; kill-gate re-run from 04-12) |
| 04-13-T1 | 04-13 | 9 | REF-01, REF-02, OFF-01 | — | Full gate, ENG-09 re-measure with the worker active (D-22), BENCH_GATE tables incl. rim case (M2); session.md marker line `- SC1/D-02 reported to user 2026-11-13:` found exactly once (grep -cF = 1) and quoted; the user accepted D-02 explicitly on 2026-11-13 (NEW-10, round-3 F) | full suite + bench | `npm ci && npm run lint && npm run test:coverage && npm run build && npm run build:e2e && npm run test:e2e && npm run test:e2e:live && npm run test:dist && npm run test:pwa:live && BENCH_GATE=1 npx vitest run test/bench/warp-tiers.test.js` | ✅ | ❌ full suite green except BENCH_GATE (see 04-05-T3); SC1 marker found once |
| 04-13-T3 | 04-13 | 9 | REF-02, OFF-01 | T-04-50 | Live: commit hash, manifest scope, live e2e subset incl. Durchblick smoke, live @live pwa tests | live e2e | `BASE_URL=… npm run test:e2e:live && PWA_BASE_URL=… npm run test:pwa:live` | ✅ | ⬜ pending (Task 3, after the push) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Sampling continuity: every task above has an automated command; 04-13-T2 is the approval checkpoint (no code).

---

## Wave 0 Requirements

Every "❌ W0" file is created by the task that first needs it (RED first in the TDD tasks). 04-13 Task 1: every file below exists at d07e16d (`wave_0_complete` stays false only because the frontmatter flags follow the all-rows-green rule):

- [x] `scripts/p0-feasibility.mjs` and `04-P0-RESULTS.md` — 04-03-T3 (fixes the field half-angle, k and the tier cell sizes)
- [x] `src/engine/magnification.test.js` — 04-01-T2; `src/engine/warp.test.js`, `src/engine/outline-geom.test.js` — 04-03-T1 (fixtures: default frame, item-12 frame)
- [x] `src/state/guard.test.js` — 04-05-T1
- [x] `e2e/support/switch-server.js` and the `pwa` Playwright project; `serviceWorkers: 'block'` on `desktop`/`mobile` — 04-06-T2
- [x] Build B for the update tests (`APP_VERSION_OVERRIDE`, `npm run build:b`, built lazily by the pwa spec) — 04-14-T2; the kill build (`npm run build:kill`) and the rehearsal — 04-14-T3
- [x] `sw-kill-switch.js` and `test/dist/sw-shape.js` — 04-04 (M1)
- [x] `test/dist/parity.test.js`, `test/ci/env-gates.test.js` — 04-02-T1 (M4); `e2e/ref-live.spec.js` in `LIVE_SPECS` — 04-08-T1 (M4)
- [x] `e2e/support/flaky-reporter.js`, `test/ci/flaky-reporter.test.js` — 04-15-T1
- [x] `scripts/measure-stages.mjs` — 04-03-T3 (MINOR 2)
- [x] `test/dist/pwa-build.test.js` — 04-04-T2 (in the `dist` Vitest project, run by `npm run test:dist` after both builds)
- [x] CI: e2e build mode and the hook-free live subset (`e2e/support/live-specs.js`); `workflow-structure.test.js` updated — 04-02

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Durchblick runs acceptably on the real phone (F-05 trace) | REF-02 | Needs the user's phone on the live site; the 4× throttled proxy only covers the main thread | 04-13-T3 step 4: open the live site on the phone, switch to Durchblick, change the prescription 10 times, record the performance trace and note whether the lower-resolution note appears. **Status: ✅ user-reported 2026-11-14** on a Pixel 7 Pro, Android 17, Chrome 157.0.8103.78: "it works perfect". No performance trace or millisecond values were recorded. Proxy (04-13 T1, 4×, SwiftShader): default median 92,2 / p95 103,4 ms, fein kept; rim case median 103,2 / p95 261,8 ms, fein → mittel |
| Screen-reader and keyboard path through the Durchblick controls and the update prompt | REF-01, OFF-01 | axe covers only part of WCAG | 04-13-T3 step 4 (v): Tab through the view switch, the Durchblick controls and the "Aktualisieren" prompt; check the announcements. **Status: pending (Task 3).** Automated part green at d07e16d: a11y.spec 54/0 (axe matrix incl. banner states), pwa item 19 keyboard route |
| Primary textbook page for the spectacle-magnification formula and the 3 mm entrance-pupil offset (Bennett & Rabbetts) | REF-01 | Not accessible to the agents (orchestrator decision 3) | Open human item; the code and `tech.ref.formulaSource` say what the fetched sources support (product form with the vertex distance; entrance pupil from the derivation and US 8,805,612 B2) and that the textbook page is not verified (M5). **Status: open (unverified, no access)** |
| D-02 / ROADMAP SC1 reinterpretation confirmation | REF-01 | User preference, not a test (orchestrator decision 6) | Reported by the orchestrator in its final planning message on 2026-11-13 and recorded in session.md (NEW-10; 04-13-T1 guard checks the record); 04-13 Task 2 asks for confirmation only; the M3 on-screen tests (04-08-T3) are the automated gate. **04-13 T1:** session.md marker found exactly once (line 57, "accepted explicitly by the user the same day"); M3 tests green in view-ref.spec (53 passed / 0 failed); confirmation pending at Task 2 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [ ] Feedback latency < 120s (not confirmed: the quick command was not timed separately in 04-13; the full unit coverage run took about 3 min, the full e2e 26,6 min)
- [ ] `nyquist_compliant: true` set in frontmatter (04-13 Task 1, only when every row is green) — NOT set: rows 04-05-T3 and 04-13-T1 are red (BENCH_GATE budgets) and 04-13-T3 is pending

**Approval:** statuses set by 04-13 Task 1 at d07e16d (2026-11-14); not nyquist-compliant until the BENCH_GATE budget finding is closed or accepted and 04-13-T3 is green
