---
phase: 4
slug: refraction-view-offline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-13
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `04-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.1.0 (project `unit`, node env) + fast-check 4.10.2; Playwright 1.65.0 + @axe-core/playwright 4.14.0; chrome-devtools MCP for live checks at phone size |
| **Config file** | `vite.config.js` (`test.projects`), `playwright.config.js` (new `pwa` project with `serviceWorkers: 'allow'`; `desktop`/`mobile` set to `serviceWorkers: 'block'`) |
| **Quick run command** | `npx vitest run --project unit src/engine/warp.test.js src/engine/magnification.test.js src/engine/trace.test.js` |
| **Full suite command** | `npm run lint && npm run test:coverage && npm run build && npm run test:e2e` |
| **Estimated runtime** | not measured yet; the planner records it after Wave 0 |

---

## Sampling Rate

- **After every task commit:** Run the quick run command, plus the one affected spec file.
- **After every plan wave:** Run `npm run test:coverage`, `npm run build` and the affected Playwright projects.
- **Before `/gsd-verify-work`:** The full suite must be green in CI (with the e2e build split). Also take the chrome-devtools MCP screenshots listed in the UI-SPEC and get the lens-critic result review.
- **Max feedback latency:** 120 seconds (carried over from phase 3; confirm after Wave 0)

---

## Per-Task Verification Map

Task IDs are filled by the planner. Requirement behaviours come from `04-RESEARCH.md` § Phase Requirements → Test Map.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| — | — | — | REF-01 | — | Plano → identity warp within the tier tolerance | unit/property | `npx vitest run src/engine/warp.test.js -t identity` | ❌ W0 | ⬜ pending |
| — | — | — | REF-01 | — | Sign: minus minifies, plus magnifies, all materials | property | `npx vitest run src/engine/warp.test.js -t sign` | ❌ W0 | ⬜ pending |
| — | — | — | REF-01 | — | Grid paraxial = spectacle-magnification formula ≤ 0,05 pp, both meridians | unit | `npx vitest run src/engine/magnification.test.js` | ❌ W0 | ⬜ pending |
| — | — | — | REF-01 | — | Wearer-view axis golden values, OD and OS | unit | `npx vitest run src/engine/warp.test.js -t golden` | ❌ W0 | ⬜ pending |
| — | — | — | REF-01 | — | Aperture classes 1–5, no NaN, TIR/miss defined | unit | `npx vitest run src/engine/warp.test.js -t aperture` | ❌ W0 | ⬜ pending |
| — | — | — | REF-01 | — | Interpolation ≤ 0,5 px at the panel edge, class boundary ≤ 2 px per tier | unit | `npx vitest run src/engine/warp.test.js -t tolerance` | ❌ W0 | ⬜ pending |
| — | — | — | REF-01 | — | ENG-08 oracle unchanged | unit | `npx vitest run src/engine/trace.test.js` | ✅ | ⬜ pending |
| — | — | — | REF-01 | — | Picture and pixels, mode switch, stale badge | e2e | `npx playwright test e2e/view-ref.spec.js` | ❌ W0 | ⬜ pending |
| — | — | — | REF-02 | — | `nextGuard` degradation steps | unit | `npx vitest run src/state/guard.test.js` | ❌ W0 | ⬜ pending |
| — | — | — | REF-02 | — | Per-tier worker bench | bench | `npx vitest bench src/engine/warp.bench.js` | ❌ W0 | ⬜ pending |
| — | — | — | REF-02 | — | 4× throttled input → Durchblick paint (informational) | perf | `npm run test:perf` | ✅ extend | ⬜ pending |
| — | — | — | OFF-01 | SW scope | Manifest scope/start_url = `/Eyeglass-Prescription/`, precache contents, size < 2 MB, no hook strings in `dist/` | build test | `npx vitest run test/ci/pwa-build.test.js` | ❌ W0 | ⬜ pending |
| — | — | — | OFF-01 | SW scope | Offline reload computes, 3D and Durchblick work; scope at runtime | e2e (`pwa`) | `npx playwright test --project=pwa e2e/pwa.spec.js -g offline` | ❌ W0 | ⬜ pending |
| — | — | — | OFF-01 | stale cache | Update prompt, handover, several tabs, Später, failure | e2e (`pwa`) | `npx playwright test --project=pwa e2e/pwa.spec.js -g update` | ❌ W0 | ⬜ pending |
| — | — | — | OFF-01 | — | controllerchange-only reload path with stubbed plugin | unit | `npx vitest run src/ui/update.test.js` | ❌ W0 | ⬜ pending |
| — | — | — | OFF-01 | T-02-39 | Storage allow-list: only `handover.js`, one key | unit | `npx vitest run src/engine/boundary.test.js` | ✅ amend | ⬜ pending |
| — | — | — | OFF-01 | CSP | CSP string unchanged with the service worker active | e2e | `npx playwright test e2e/worker.spec.js -g CSP` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/p0-feasibility.mjs` and its committed output table — fixes the field half-angle, the interpolation constant and the tier cell sizes
- [ ] `src/engine/warp.test.js`, `src/engine/magnification.test.js` — fixtures: default frame, item-12 frame
- [ ] `src/state/guard.test.js`
- [ ] `e2e/support/switch-server.mjs` and the `pwa` Playwright project (separate port, `serviceWorkers: 'allow'`); `serviceWorkers: 'block'` on `desktop`/`mobile`
- [ ] Build B for the update tests — an env override of `APP_VERSION` in `vite.config.js`
- [ ] `test/ci/pwa-build.test.js` — reads `dist/manifest.webmanifest` and `dist/sw.js`
- [ ] CI: e2e build mode and `@live` tag split; update `workflow-structure.test.js`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Durchblick runs acceptably on the real phone (F-05 trace) | REF-02 | Needs the user's Pixel on the live site; the 4× throttled proxy only covers the main thread | Open the live site on the phone, switch to Durchblick, change the prescription several times, record the performance trace and note whether the lower-resolution note appears |
| Screen-reader and keyboard path through the Durchblick controls and the update prompt | REF-01, OFF-01 | axe covers only part of WCAG | Tab through the view switch, the Durchblick controls and the "Aktualisieren" prompt; check the announcements |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
