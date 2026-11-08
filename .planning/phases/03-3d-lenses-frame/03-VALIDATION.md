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

Task IDs are filled by the planner, one row per requirement behaviour (see 03-RESEARCH.md § Phase Requirements → Test Map).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | VIZ-01 | — | N/A | unit + fast-check | `npx vitest run src/engine/mesh/lens.test.js src/engine/mesh/tessellation.test.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VIZ-02 | — | N/A | unit | `npx vitest run src/engine/mesh/frame.test.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VIZ-03 | — | N/A | unit + e2e | `npx vitest run src/engine/rim.test.js && npx playwright test e2e/view.spec.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VIZ-04 | — | N/A | e2e | `npx playwright test e2e/view.spec.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VIZ-05 / UX-02 | HTML injection | labels via textContent only | unit + e2e | `npx vitest run src/engine/mesh/heat.test.js && npx playwright test e2e/view-heat.spec.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VIZ-06 | stale/forged worker msgs; DoS | generation + slot checks; fixed topology | unit + e2e | `npx vitest run src/state/compute-client.test.js src/state/compute-protocol.test.js && npx playwright test e2e/view-memory.spec.js` | ✅ extend / ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | RES-03 | — | N/A | e2e | `npx playwright test e2e/view-compare.spec.js` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UX-03 | — | N/A | e2e (mobile) | `npx playwright test e2e/view.spec.js --project=mobile` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UX-04 carry | — | N/A | e2e | `npx playwright test e2e/a11y.spec.js` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | CSP / boundary | supply chain | CSP unchanged; `three` banned outside view | unit + e2e | `npx vitest run src/engine/boundary.test.js && npx playwright test e2e/worker.spec.js` | ✅ extend | ⬜ pending |

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
