---
phase: 1
slug: verified-engine-live-pipeline
status: draft
nyquist_compliant: true
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

Task IDs are `{plan}-T{n}` (revised 2026-11-06: 11 plans). Every auto task has an `<automated>` verify; the three checkpoint tasks are human gates and are bracketed by automated tasks, so no 3 consecutive tasks lack an automated check.

| Task ID | Wave | Requirement(s) | Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|----------------|----------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 1 | DEPL-04 | package legitimacy approved before install | human gate | — (blocking-human checkpoint) | n/a | ⬜ pending |
| 01-01-T2 | 1 | DEPL-01, DEPL-03, DEPL-04 | exact pins, configs, smoke RED | lint + e2e (RED) | `npm run lint && npx playwright test --project=desktop` (expected non-zero) | ❌ W0 | ⬜ pending |
| 01-01-T3 | 1 | RX-02, L10N-01, L10N-02 | parser table, de-AT format, t() throws, tolerance wording | unit | `npx vitest run src/state/parse.test.js src/i18n/format.test.js src/i18n/dictionary.test.js` | ❌ W0 | ⬜ pending |
| 01-02-T1 | 2 | MAT-01, MAT-02, ENG-07 | conventions/locationLabel, sag, Vogel reference + conic-aware search bound (D-01), CR-39, catalogue incl. diag('NOPE') | unit + property | `npx vitest run src/engine/conventions.test.js src/engine/sag.test.js src/engine/power.test.js src/engine/materials.test.js src/engine/diagnostics.test.js` | ❌ | ⬜ pending |
| 01-02-T2 | 2 | ENG-02, ENG-04, ENG-06 | thick-lens CT solve (warm start, maxThickness), GL24 quadrature, metrics/volume | unit | `npx vitest run src/engine && npm run test:coverage` | ❌ | ⬜ pending |
| 01-02-T3 | 2 | MAT-02, ENG-05, ENG-07 | always-thinnest search + evaluate contract: rescue count 0, optimum ≤ brute force + 0,10 mm, J ≤ Vogel reference, eye-symmetry rule | unit | `npx vitest run src/engine/solve.test.js src/engine/evaluate.test.js && npm run test:coverage` | ❌ | ⬜ pending |
| 01-03-T1 | 3 | L10N-01, L10N-02, RES-06 | page shell, dictionary keys | unit + grep | `npx vitest run src/i18n/dictionary.test.js` | ❌ | ⬜ pending |
| 01-03-T2 | 3 | RX-02, RES-06, ENG-09, DEPL-01 | smoke GREEN desktop + mobile, timing (current input incl. search + fixed worst-case pair) + input-to-render readout, informational desktop bench | e2e + bench (no gate) | `npx vitest run test/bench/recompute.test.js && npm run build && npm run test:e2e` | ❌ W0 | ⬜ pending |
| 01-04-T1 | 4 | DEPL-03, DEPL-04, DEPL-02 | boundary negative tests; pins/structure RED | unit | `npx vitest run src/engine/boundary.test.js` | ❌ W0 | ⬜ pending |
| 01-04-T2 | 4 | DEPL-02, DEPL-04 | SHA-pinned gated workflow | unit (structure) | `npx vitest run test/ci src/engine/boundary.test.js` | ❌ W0 | ⬜ pending |
| 01-05-T1 | 5 | DEPL-01 | full local gate, push manifest | full suite | `npm run lint && npm run test:coverage && npm run build && npm run test:e2e` | ✅ after W4 | ⬜ pending |
| 01-05-T2 | 5 | DEPL-01 | D-02 approval 1 | human gate | — (decision checkpoint) | n/a | ⬜ pending |
| 01-05-T3 | 5 | DEPL-01, DEPL-02 | Pages enabled, live smoke | e2e (live) | `BASE_URL=https://ainxtgendev.github.io/Eyeglass-Prescription/ npm run test:e2e` | ✅ | ⬜ pending |
| 01-06-T1 | 6 | MAT-01 | six cited materials incl. Trivex; engine uses ne | unit | `npx vitest run src/engine/materials.test.js` | ❌ | ⬜ pending |
| 01-06-T2 | 6 | ENG-08, ENG-02, ENG-04 | Zeiss rows (a)(b)(c) ±0,20 mm, CT-solver subset reported | fixture | `npx vitest run test/fixtures/zeiss.test.js` | ❌ W0 | ⬜ pending |
| 01-06-T3 | 6 | MAT-01, MAT-02 | material select changes thickness | e2e | `npm run build && npm run test:e2e` | ✅ | ⬜ pending |
| 01-07-T1 | 7 | FRAME-01 | bbox A×B, star-shaped, OS mirror, pilot orientation documented | unit | `npx vitest run src/engine/frame/outline.test.js` | ❌ | ⬜ pending |
| 01-07-T2 | 7 | ENG-05, ENG-06, ENG-04 | decentration per eye, fitting height, frame cap on real outline | unit | `npx vitest run src/engine/evaluate.test.js -t decentration` | ❌ | ⬜ pending |
| 01-07-T3 | 7 | FRAME-01 | shape/A/B/DBL/PD inputs | e2e | `npm run build && npm run test:e2e` | ✅ | ⬜ pending |
| 01-08-T1 | 8 | ENG-03, ENG-04, ENG-05 | true torus, tyre golden vs barrel, TABO golden, OD/OS point reflection | unit | `npx vitest run src/engine/sag.test.js src/engine/evaluate.test.js src/engine/solve.test.js` | ❌ | ⬜ pending |
| 01-08-T2 | 8 | ENG-01, ENG-02, ENG-08 | D(θ), power matrix, BVP round trip ≤ 0,01 dpt (design + evaluateLens), implicit-torus check | unit + property | `npx vitest run src/engine/trace.test.js src/engine/power.test.js` | ❌ | ⬜ pending |
| 01-09-T1 | 9 | RX-03 | transposition round trip | unit + property | `npx vitest run src/state/transpose.test.js` | ❌ | ⬜ pending |
| 01-09-T2 | 9 | RX-03, L10N-01 | both cylinder forms on the page, missing axis error | e2e | `npm run build && npm run test:e2e` | ✅ | ⬜ pending |
| 01-10-T1 | 10 | ENG-07, ENG-04, MAT-02 | SC-4 demo error (impossible for every D1), D-01 final pins + all-lens optimality, rescue count 0 asserted over grid and fuzz, truthful suggestions, fuzz | unit + property | `npx vitest run src/engine/diagnostics.test.js` | ❌ | ⬜ pending |
| 01-10-T2 | 10 | L10N-02, ENG-07 | every code has German keys, no orphans; page shows diagnostics | unit + e2e | `npx vitest run src/i18n/dictionary.test.js && npm run build && npm run test:e2e` | ✅ | ⬜ pending |
| 01-10-T3 | 10 | ENG-08, ENG-06 | tier-4 invariants incl. point reflection, oblique-axis pair check, thinnest-lens monotonicity (≤ 0,005 mm drop) | property | `npx vitest run src/engine/properties.test.js` | ❌ | ⬜ pending |
| 01-11-T1 | 11 | all 21 | full gate, requirement trace, lens-critic result review | full suite | `npm run lint && npm run test:coverage && npm run build && npm run test:e2e` | ✅ | ⬜ pending |
| 01-11-T2 | 11 | DEPL-01 | D-02 approval 2 | human gate | — (decision checkpoint) | n/a | ⬜ pending |
| 01-11-T3 | 11 | ENG-09, DEPL-01, RES-06 | live smoke + real-phone timing (case A −4/−2×30 default Rechteckig and case B +6/−2×30 in 62×55/24/25, both running the thinnest-lens search; Grenzfall readout) | e2e (live) + manual | `BASE_URL=https://ainxtgendev.github.io/Eyeglass-Prescription/ npm run test:e2e` | ✅ | ⬜ pending |

Test naming rule (revised 2026-11-06, lens-critic iteration-2 m4): every test that is evidence for a requirement carries the requirement ID in its own name or an enclosing `describe` name (set in 01-02 and applied by every later plan), so the `-t '<ID>'` commands below select exactly that evidence. Vitest 5.1.0 exits 0 when `-t` matches nothing (checked in a scratch install during planning), so 01-11 runs every Vitest row with `--reporter=json` and counts a row as passing only with numPassedTests ≥ 1 and numFailedTests = 0.

Requirement → test map (traced to tasks above; ENG-04, ENG-05, ENG-06, MAT-02 commands revised 2026-11-06 so they exercise what they claim):

| Requirement | Behavior | Test Type | Automated Command | Tasks |
|-------------|----------|-----------|-------------------|-------|
| DEPL-01 | built site loads under base, no 4xx, no third-party hosts | e2e | `npx playwright test e2e/smoke.spec.js` | 01-01-T2, 01-03-T2, 01-05-T3, 01-11-T3 |
| DEPL-02 | failing gate blocks deploy | structural + manual demo | `npx vitest run test/ci/workflow-structure.test.js` | 01-04-T1, 01-04-T2, 01-05-T3 |
| DEPL-03 | engine import/DOM ban | unit (ESLint API) | `npx vitest run src/engine/boundary.test.js` | 01-01-T2, 01-04-T1 |
| DEPL-04 | SHA pins + exact npm pins | unit | `npx vitest run test/ci/pins.test.js` | 01-01-T2, 01-04-T2 |
| ENG-01 | D(θ) identities, power matrix | unit | `npx vitest run src/engine/power.test.js` | 01-08-T2 |
| ENG-02 | BVP round trip ≤ 0.01 D full range | property (oracle) | `npx vitest run src/engine/trace.test.js` | 01-02-T2, 01-08-T2 |
| ENG-03 | true torus, stable at c→0, domain → NaN, tyre golden | unit | `npx vitest run src/engine/sag.test.js` | 01-08-T1 |
| ENG-04 | CT solve (solve.test.js `ENG-04 CT solve`), mixed meridians (evaluate.test.js `ENG-04 mixed meridians`), outline convergence (evaluate/properties `ENG-04 outline sampling convergence`) | unit + property | `npx vitest run src/engine -t 'ENG-04'` | 01-02-T2, 01-07-T2, 01-08-T1, 01-10-T3 |
| ENG-05 | decentration per eye (`ENG-05 decentration`), nasal/temporal asymmetry, OD/OS point reflection (`ENG-05 OD/OS point reflection`, not mirrored) | unit + property | `npx vitest run src/engine -t 'ENG-05'` | 01-02-T3, 01-07-T2, 01-08-T1, 01-10-T3 |
| ENG-06 | metrics, GL24 quadrature, volume, weight | unit | `npx vitest run src/engine/metrics.test.js src/engine/quadrature.test.js` | 01-02-T2, 01-07-T2 |
| ENG-07 | impossible cases → codes (only when no D1 computes); no NaN in fuzz; rescue count 0; catalogue incl. diag('NOPE') | unit + property | `npx vitest run src/engine/diagnostics.test.js` | 01-02-T1, 01-02-T3, 01-10-T1 |
| ENG-08 | Zeiss rows (a)(b)(c) within ±0,20 mm (stricter than Zeiss ±0,30 / +0,30−0,20); oracle; tier 4 | fixture + property | `npx vitest run test/fixtures/zeiss.test.js` | 01-06-T2, 01-08-T2, 01-10-T3 |
| ENG-09 | recompute < 16,7 ms on phone; every automatic recompute runs the search (cases A and B both search cases) | manual (+ informational bench, never a gate) | live-page readout; `npx vitest run test/bench/recompute.test.js` (desktop, informational) | 01-03-T2, 01-11-T3 |
| MAT-01 | six material rows cited (incl. Trivex); engine uses ne | unit | `npx vitest run src/engine/materials.test.js` | 01-02-T1, 01-06-T1 |
| MAT-02 | thinnest feasible base curve (search, optimality, rescue 0, monotonicity), Vogel as sourced reference (worked examples, clamp), conic-aware bound (MAT-02 text re-worded by the orchestrator) | unit | `npx vitest run src/engine -t 'MAT-02'` | 01-02-T1, 01-02-T3, 01-07-T2, 01-10-T1, 01-10-T3 |
| RX-02 | parser table + echo format | unit | `npx vitest run src/state/parse.test.js src/i18n/format.test.js` | 01-01-T3, 01-03-T2 |
| RX-03 | transposition, both forms | unit + e2e | `npx vitest run src/state/transpose.test.js` | 01-09-T1, 01-09-T2 |
| FRAME-01 | bbox A×B, star-shaped, OS mirror | unit | `npx vitest run src/engine/frame/outline.test.js` | 01-07-T1, 01-07-T3 |
| L10N-01 | `lang=de-AT`, −0, U+2212 | unit + e2e | `npx vitest run src/i18n/format.test.js` | 01-01-T3, 01-03-T1 |
| L10N-02 | every code has dictionary keys; `t()` throws on missing | unit | `npx vitest run src/i18n/dictionary.test.js` | 01-01-T3, 01-10-T2 |
| RES-06 | disclaimer visible next to result | e2e | `npx playwright test e2e/smoke.spec.js` | 01-03-T1, 01-03-T2 |

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (planner, 2026-11-06)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [ ] Feedback latency < 120 s
- [x] `nyquist_compliant: true` set in frontmatter (`wave_0_complete` stays false until 01-01 executes; the executor flips it)

**Approval:** pending
