---
phase: 1
slug: verified-engine-live-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-06
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `01-RESEARCH.md` → Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.1.0 (node env) + fast-check 4.10.2; Playwright 1.65.0 (chromium) + @axe-core/playwright |
| **Config file** | none yet — Wave 0 creates `vite.config.js` (test.projects + coverage) and `playwright.config.js` |
| **Quick run command** | `npx vitest run --project unit` |
| **Full suite command** | `npm run lint && npx vitest run --coverage && npm run build && npx playwright test` |
| **Estimated runtime** | quick < 5 s; full ~90 s |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --project unit`
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full suite green locally and in CI, `verify-live` green, real-phone timing recorded, lens-critic PASS
- **Max feedback latency:** 5 seconds (quick), 120 seconds (full)

---

## Per-Task Verification Map

Requirement → test map (task IDs are filled in by the planner/executor):

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| DEPL-01 | built site loads under base, no 4xx, no third-party hosts | e2e | `npx playwright test e2e/smoke.spec.js` | ❌ W0 | ⬜ pending |
| DEPL-02 | failing gate blocks deploy | structural + manual demo | `npx vitest run test/ci/workflow-structure.test.js` | ❌ W0 | ⬜ pending |
| DEPL-03 | engine import/DOM ban | unit (ESLint API) | `npx vitest run src/engine/boundary.test.js` | ❌ W0 | ⬜ pending |
| DEPL-04 | SHA pins + exact npm pins | unit | `npx vitest run test/ci/pins.test.js` | ❌ W0 | ⬜ pending |
| ENG-01 | D(θ) identities, power matrix | unit | `npx vitest run src/engine/power.test.js` | ❌ | ⬜ pending |
| ENG-02 | BVP round trip ≤ 0.01 D full range | property (oracle) | `npx vitest run src/engine/trace.test.js` | ❌ | ⬜ pending |
| ENG-03 | true torus, stable at c→0, domain → NaN | unit | `npx vitest run src/engine/sag.test.js` | ❌ | ⬜ pending |
| ENG-04 | CT solve incl. mixed meridians, outline convergence | unit + property | `npx vitest run src/engine/solve.test.js` | ❌ | ⬜ pending |
| ENG-05 | decentration per eye, nasal/temporal asymmetry, OD/OS not mirrored | unit | `npx vitest run src/engine/evaluate.test.js -t decentration` | ❌ | ⬜ pending |
| ENG-06 | metrics, volume, weight | unit | `npx vitest run src/engine/metrics.test.js` | ❌ | ⬜ pending |
| ENG-07 | impossible cases → codes; no NaN in fuzz | unit + property | `npx vitest run src/engine/diagnostics.test.js` | ❌ | ⬜ pending |
| ENG-08 | Zeiss rows (a)(b)(c) within ±0,20 mm | fixture | `npx vitest run test/fixtures/zeiss.test.js` | ❌ | ⬜ pending |
| ENG-09 | recompute < 16,7 ms on phone | manual | live-page readout | manual | ⬜ pending |
| MAT-01 | material rows cited; engine uses ne | unit | `npx vitest run src/engine/materials.test.js` | ❌ | ⬜ pending |
| MAT-02 | Vogel examples, clamp, `BASE_CURVE_CLAMPED` | unit | `npx vitest run src/engine/power.test.js -t vogel` | ❌ | ⬜ pending |
| RX-02 | parser table + echo format | unit | `npx vitest run src/state/parse.test.js src/i18n/format.test.js` | ❌ | ⬜ pending |
| RX-03 | transposition, both forms | unit + e2e | `npx vitest run src/state/transpose.test.js` | ❌ | ⬜ pending |
| FRAME-01 | bbox A×B, star-shaped, OS mirror | unit | `npx vitest run src/engine/frame/outline.test.js` | ❌ | ⬜ pending |
| L10N-01 | `lang=de-AT`, −0, U+2212 | unit + e2e | `npx vitest run src/i18n/format.test.js` | ❌ | ⬜ pending |
| L10N-02 | every code has dictionary keys; `t()` throws on missing | unit | `npx vitest run src/i18n/dictionary.test.js` | ❌ | ⬜ pending |
| RES-06 | disclaimer visible next to result | e2e | `npx playwright test e2e/smoke.spec.js` | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` scripts: `lint`, `test`, `test:coverage`, `build`, `preview`, `test:e2e`
- [ ] `vite.config.js`, `eslint.config.js`, `playwright.config.js`, `.nvmrc`, `.npmrc`
- [ ] `src/engine/boundary.test.js`, `test/ci/pins.test.js`, `test/ci/workflow-structure.test.js`
- [ ] `test/fixtures/zeiss-fsv-6-23-cr39-spherical.json` (RESEARCH Appendix A) + loader
- [ ] `e2e/smoke.spec.js`
- [ ] Framework install (`npm install -D --save-exact …`); `npx playwright install --with-deps chromium` in CI

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Recompute time on a real mid-range phone | ENG-09 | needs a physical device | Open live URL on phone, read the timing readout, record device + value in VERIFICATION.md |
| Failing push does not deploy | DEPL-02 | needs a real CI run | Push a deliberately failing commit on a branch/PR, confirm no deploy job runs |
| Live site renders on desktop + phone | DEPL-01, RES-06 | real Pages host | Load https://ainxtgendev.github.io/Eyeglass-Prescription/ on both |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
