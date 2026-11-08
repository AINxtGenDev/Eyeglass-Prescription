---
phase: 3
slug: 3d-lenses-frame
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-08
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `03-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.1.0 (project `unit`, node env) + fast-check 4.10.2; Playwright 1.65.0 + @axe-core/playwright 4.14.0; chrome-devtools MCP for live checks (D-30) |
| **Config file** | `vite.config.js` (`test.projects`, coverage on `src/engine/**` incl. `src/engine/mesh/`), `playwright.config.js` (desktop 1280, mobile 360 hasTouch; perf only with PERF=1) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run lint && npm run test:coverage && npm run build && npm run test:e2e` |
| **Estimated runtime** | about 120 seconds (tessellation sweep about 10 s; WebGL e2e on SwiftShader) |

---

## Sampling Rate

- **After every task commit:** Run `npm test`. For view tasks, also run `npm run build && npx playwright test e2e/view*.spec.js` and do the chrome-devtools MCP checks.
- **After every plan wave:** Run the full suite command.
- **Before `/gsd-verify-work`:** The full suite must be green. Also record `npm run test:perf`, finish the MCP matrix, record the Pixel 7 Pro numbers and get the lens-critic result review.
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Task IDs filled by the planner 2026-11-08 (one row per task; requirement behaviours from 03-RESEARCH.md § Phase Requirements → Test Map).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-02-T1 | 03-02 | 1 | CSP / boundary | T-03-06 | `three` rejected outside src/ui/view/**; HTML-sink ban kept | unit | `npx vitest run src/engine/boundary.test.js` | ✅ extend | ⬜ pending |
| 03-02-T2 | 03-02 | 1 | VIZ-01 | T-03-04, T-03-05 | D-04 (a)(b)(d), finite flag, fixed lengths | unit + fast-check | `npx vitest run src/engine/mesh/lens.test.js -t "VIZ-01"` | ❌ W0 | ⬜ pending |
| 03-02-T3 | 03-02 | 1 | VIZ-01 | T-03-04 | D-04 (c) ≤ 0,01 mm (nₑ ≥ 1,49), ≤ 0,025 mm (custom nₑ < 1,49, user-accepted 2026-11-08) | unit | `npx vitest run src/engine/mesh/tessellation.test.js` | ❌ W0 | ⬜ pending |
| 03-01-T1 | 03-01 | 1 | VIZ-03 | T-03-01 | bevelSplit non-negative, sum = t − D, rule '1:2' | unit + fast-check | `npx vitest run src/engine/rim.test.js` | ✅ extend | ⬜ pending |
| 03-01-T2 | 03-01 | 1 | VIZ-03 | T-03-02, T-03-03 | Expert rim lines from bevelSplit (deliberate phase-2 change) | e2e | `npx playwright test e2e/expert.spec.js e2e/frame.spec.js` | ✅ extend | ⬜ pending |
| 03-03-T1 | 03-03 | 2 | VIZ-02 | T-03-07, T-03-09 | bridge = DBL, rim on bevel curve = bevelSplit, offsets simple, temple length | unit | `npx vitest run src/engine/mesh/frame.test.js -t "VIZ-02"` | ❌ W0 | ⬜ pending |
| 03-03-T2 | 03-03 | 2 | VIZ-05 | T-03-08 | D-04 (e) callouts = meridianProfile/metrics; scale = thinnest/thickest | unit | `npx vitest run src/engine/mesh/heat.test.js -t "VIZ-05"` | ❌ W0 | ⬜ pending |
| 03-04-T1 | 03-04 | 2 | VIZ-06 | T-03-11 | mesh items validated, never throws, transferOf | unit | `npx vitest run src/state/compute-protocol.test.js` | ✅ extend | ⬜ pending |
| 03-04-T2 | 03-04 | 2 | VIZ-06 | T-03-10, T-03-12 | latest-wins mesh lane, own generation, buffers never lost, main waits ≤ 1 mesh job | unit | `npx vitest run src/state/compute-client.test.js` | ✅ extend | ⬜ pending |
| 03-05-T1/T2 | 03-05 | 3 | VIZ-01, VIZ-04, VIZ-06 | T-03-SC, T-03-14…17 | lenses render at card edge thickness; ior = nₑ; corner #f3f4f6; no-WebGL; lazy chunk | e2e | `npx playwright test e2e/view.spec.js` | ❌ W0 | ⬜ pending |
| 03-06-T1 | 03-06 | 4 | VIZ-02 | T-03-18 | frame item validated | unit | `npx vitest run src/state/compute-protocol.test.js` | ✅ extend | ⬜ pending |
| 03-06-T2 | 03-06 | 4 | VIZ-02 | T-03-19, T-03-20 | bridge span = DBL, temple from stamp, rim depth display-only | e2e | `npx playwright test e2e/view.spec.js -g "VIZ-02"` | ❌ W0 | ⬜ pending |
| 03-07-T1 | 03-07 | 5 | VIZ-04 / VIZ-06 | T-03-21 | tier choice and dispersion mapping | unit | `npx vitest run src/ui/view/tiers.test.js` | ❌ W0 | ⬜ pending |
| 03-07-T2 | 03-07 | 5 | VIZ-04 / VIZ-06 | T-03-22, T-03-23 | chart untone-mapped behind lenses; tiers; context loss/restore | e2e | `npx playwright test e2e/view.spec.js -g "VIZ-04\|D-12\|context"` | ❌ W0 | ⬜ pending |
| 03-08-T1 | 03-08 | 6 | VIZ-03 | — | preset poses, side eye, key steps, step-down monitor | unit | `npx vitest run src/ui/view/camera-math.test.js` | ❌ W0 | ⬜ pending |
| 03-08-T2/T3 | 03-08 | 6 | VIZ-03 | T-03-25, T-03-26, T-03-27 | presets, reduced motion, keyboard, wheel only with focus, touch toggle + auto-off, one camera | e2e | `npx playwright test e2e/view-controls.spec.js` | ❌ W0 | ⬜ pending |
| 03-09-T1 | 03-09 | 7 | VIZ-03 | T-03-28 | protrusion text = bevelSplit rule; aria sentence | unit | `npx vitest run src/ui/view/text.test.js` | ❌ W0 | ⬜ pending |
| 03-09-T2 | 03-09 | 7 | VIZ-03 | T-03-28, T-03-29 | Seite note + fade; protrusion text equals Expert rim rule; aria summary | e2e | `npx playwright test e2e/view-controls.spec.js -g "protrusion\|Seite\|D-29"` | ❌ W0 | ⬜ pending |
| 03-10-T1 | 03-10 | 8 | VIZ-05 | T-03-30 | cividis LUT, iso formatters | unit | `npx vitest run src/ui/view/cividis.test.js src/i18n/format.test.js` | ❌ W0 | ⬜ pending |
| 03-10-T2 | 03-10 | 8 | VIZ-05 / UX-02 | T-03-30…33 | Dickenkarte Expert-only; table = engine numbers; pixel = legend colour; axe | e2e | `npx playwright test e2e/view-heat.spec.js` | ❌ W0 | ⬜ pending |
| 03-11-T1 | 03-11 | 9 | VIZ-05 | T-03-36 | label layout priority and bounds | unit | `npx vitest run src/ui/view/label-layout.test.js` | ❌ W0 | ⬜ pending |
| 03-11-T2 | 03-11 | 9 | VIZ-05 | T-03-34, T-03-35 | callouts = table; eye picker; no overlap at 320/1280 | e2e | `npx playwright test e2e/view-heat.spec.js -g "callouts\|eye picker\|overlap\|iso"` | ❌ W0 | ⬜ pending |
| 03-12-T1 | 03-12 | 10 | RES-03 | — | frameA item; compareEye; compare camera context | unit | `npx vitest run src/state/compute-protocol.test.js src/ui/view/camera-math.test.js` | ✅ extend | ⬜ pending |
| 03-12-T2 | 03-12 | 10 | RES-03 | T-03-37…39 | side by side ≥ 360 px, same scale, toggle < 360, shared heat scale, no GPU churn | e2e | `npx playwright test e2e/view-compare.spec.js` | ❌ W0 | ⬜ pending |
| 03-13-T1 | 03-13 | 11 | UX-03 | T-03-41, T-03-43 | bar thumbnail non-blank while editing; no copies during orbit | e2e (mobile) | `npx playwright test e2e/view.spec.js --project=mobile -g "UX-03"` | ❌ W0 | ⬜ pending |
| 03-13-T2 | 03-13 | 11 | VIZ-06 | T-03-40, T-03-42 | D-27 leak test ≥ 50 changes + expected counts; sync fallback 3D; CSP | e2e + perf | `npx playwright test e2e/view-memory.spec.js e2e/worker.spec.js && npm run test:perf` | ❌ W0 / ✅ extend | ⬜ pending |
| 03-13-T3 | 03-13 | 11 | UX-02 / UX-04 carry | — | axe zero violations in all 3D states at 320/1280; keyboard path | e2e | `npx playwright test e2e/a11y.spec.js` | ✅ extend | ⬜ pending |
| 03-14-T1/T3 | 03-14 | 12 | all | T-03-44…46 | full gate, trace, live check, Pixel 7 Pro (D-28) | gate + manual | `npm run lint && npm run test:coverage && npm run build && npm run test:e2e` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/engine/mesh/lens.test.js`, `tessellation.test.js`, `frame.test.js`, `heat.test.js`: D-04 (a)–(e), finiteness, fixed lengths
- [ ] `src/engine/rim.test.js` extension: `bevelSplit`
- [ ] `src/state/compute-protocol.test.js` / `compute-client.test.js` extension: mesh lane + transfer
- [ ] `e2e/view.spec.js`, `e2e/view-heat.spec.js`, `e2e/view-compare.spec.js`, `e2e/view-memory.spec.js`
- [ ] `e2e/helpers.js`: `settledView(page)` and a `?nowebgl` test flag
- [ ] Read-only debug handle `window.__eyeglassView` (memory, tier, camera/viewName)
- [ ] No framework install needed (only runtime dep `three@0.187.0`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual correctness of the default, Vorne, Seite (protrusion), Oben, Dickenkarte, A/B, thumbnail and no-WebGL states | VIZ-03, VIZ-04, VIZ-05, RES-03, UX-03 | Visual judgement | chrome-devtools MCP at 412×915, 320×640 and 1280×800 on `vite preview`: screenshot each state and write what it shows; `list_console_messages` must be clean |
| Re-mesh latency and orbit frame time | VIZ-06 | Needs a performance trace | MCP `performance_start_trace` at 4× CPU: ≤ 200 ms from input to 3D paint, orbit median/p95 ≤ 16,7 ms |
| Real mid-range phone timing | VIZ-06 (SC-4) | Needs a real device (human) | Pixel 7 Pro on the live site, using the 02-15 method; record the numbers in VERIFICATION |
| GPU/heap memory growth | VIZ-06 (D-27) | Heap snapshot comparison | MCP `evaluate_script` `window.__eyeglassView.memory()` before and after 20 changes, plus a heap snapshot diff |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
