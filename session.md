# Session Log

## 2026-11-06 — Project setup and GSD initialization

### Done
- Created the public GitHub repo `AINxtGenDev/Brillenrezept`, then renamed it to **`AINxtGenDev/Eyeglass-Prescription`**. The old name redirects.
- Set up the local git repo on `main`, with remote `git@github.com:AINxtGenDev/Eyeglass-Prescription.git` and the first README.
- GSD 1.42.3 is installed and up to date. `gsd-sdk` is not installed, so we use `node ~/.claude/get-shit-done/bin/gsd-tools.cjs`.
- Wrote **`idea.md`**, the corrected spec. Changes from the original brief:
  - each lens surface uses its own power for its radius;
  - decentration is `(A+DBL)/2 − mono PD`;
  - the cylinder makes the back surface toric;
  - `MeshPhysicalMaterial` is only an approximation of refraction;
  - aspheric surfaces need a conic constant;
  - weight needs a density per material.
- Added the critical reviewer agent **`.claude/agents/lens-critic.md`**. It reviews every phase plan and result, and a phase passes only with no BLOCKER or MAJOR findings.
- Ran `/gsd-new-project --auto @idea.md`:
  - **Config:** coarse phases, parallel, planning docs in git, research + plan check + verifier on, quality models (Opus).
  - **Research** in `.planning/research/` (STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY, plus `scripts/` to reproduce the calculations).
  - **`.planning/REQUIREMENTS.md`**: 53 v1 requirements.
  - **`.planning/ROADMAP.md`**: 4 phases, with `.planning/STATE.md` and the project `CLAUDE.md`.

### User decisions
- **GitHub Pages:** the site goes live from phase 1 at https://ainxtgendev.github.io/Eyeglass-Prescription/. **Enabling Pages is pre-authorized** once phase 1 is ready.
- **German** (de-AT) is the only UI language in v1.
- **Ease of use for non-experts** is an equal-priority goal. UI style follows usability best practice: "as easy as possible".
- **ADD** (near addition) stays out of v1. It is explained, not modelled.
- **Reference images** are in `references/`. The folder is git-ignored and must not be published (third-party screenshots and photos).

### Key research findings
- Densities are confirmed from Zeiss data sheets: 1,32 / 1,20 / 1,30 / 1,35 / 1,47 g/cm³. Real refractive indices: 1,502 / 1,590 / 1,598 / 1,664 / 1,738.
- Vogel's rule breaks at the edges of the input range, so it must be clamped.
- The thin-lens formula is too inaccurate for plus lenses: the error is +0,26 dpt at +4 and +3,3 dpt at +12. The engine must use the thick-lens calculation.
- Minimum centre thickness must be set per material, otherwise the material comparison is misleading.
- `parseFloat("-2,25")` returns −2, so the site needs its own number parser.

### Roadmap
| # | Phase | Requirements |
|---|---|---|
| 1 | Verified engine & live pipeline (CI + Pages, minimal German page) | 21 |
| 2 | Lay-first German input, results, comparison, Expert view | 23 |
| 3 | 3D lenses & frame, heatmap | 6 |
| 4 | Refraction view & offline | 3 |

### Open items
- Phone recalculation speed (ENG-09) must be measured on a real mid-range phone through the live site.
- Unverified: whether the iOS decimal keypad has a minus key; Austrian terminology (Basiskurve vs Durchbiegung); conic constants for aspheric lenses (manufacturers don't publish them).

### Next step
Start a fresh session with `/clear`, then run `/gsd-discuss-phase 1` (or `/gsd-plan-phase 1`).

## 2026-11-06 — Phase 1 execution (`/gsd-execute-phase 1`)

### Done
- Plans are executed one per wave (11 waves), each by a `gsd-executor` on `main`. Nothing is pushed before the approval gate in 01-05.
- **01-01 done.** The user approved the 9 dev packages (checked with `npm view <pkg> version repository.url`); they are installed with exact pins. Vite, ESLint and Playwright are configured, and ESLint enforces the engine/UI boundary. The browser smoke test is written and fails on purpose until 01-03. Also built: `parseDiopter`, the de-AT formatters (`−2,25 dpt` with U+2212 and NBSP), and the `de-AT.js` dictionary plus `t()`. Lint passes and 70/70 unit tests pass.
- Executor deviation: only L10N-02 is marked complete. RX-02, L10N-01, DEPL-01, DEPL-03 and DEPL-04 stay pending until the page, CI and deploy exist.

- **01-02 done.** The engine core (`src/engine/`) has sag, an automatic base curve (a thinnest-lens search with Vogel as the starting value), CR-39, the thick-lens design with a centre-thickness fixed point, metrics, and `evaluateLens`/`evaluatePair`. Lint passes and 154/154 tests pass. Engine coverage is 97.8 % of lines and 96.8 % of branches. Example: −2,00 in a round 50/18 frame at PD 32 gives a maximum thickness of 3,27 mm (3,41 mm with Vogel). The base-curve search is within 2.5e-6 mm of a brute-force sweep. One lens takes 0.35–0.93 ms on desktop.
- Plan 01-02 deviations: the speed-up in `metrics.js` gives identical results; a volume bug at outline vertices was fixed; the Task 3 tests were not written first.
- **01-03 done.** The minimal German page is wired to the engine, and all 14 smoke tests pass (desktop + 360 px mobile, no axe violations). Example: −2,00 per eye gives a centre thickness of 1,8 mm, a maximum edge of 3,3 mm (temple side), a minimum edge of 2,9 mm (nasal) and 6,3 g. The base-curve cell shows the chosen curve with Vogel only as a comparison value, so the open "Vogel" item is resolved without contradicting D-01.
- **chrome-devtools test (local `vite preview`):** `lang=de-AT`, CSP meta present, no console errors, only 3 same-origin requests. Input `-2,25` is echoed as `−2,25 dpt` and `+1 dpt` as `+1,00 dpt`. `1.000,25` gives a German error and the other eye is still computed. −20 dpt is correctly rejected: the back radius of about 24 mm is smaller than the 27 mm decentred semi-diameter. The timing readout says "Median 0,90 ms". No `NaN` appears anywhere.
- **Fix from that test (3193223):** on the 360 px view the result-table row labels broke into single letters ("Mit/ten/di/cke"), caused by `overflow-wrap: anywhere`. They now hyphenate normally, and the e2e tests pass again.
- **01-04 done.** `.github/workflows/deploy.yml` runs build → deploy → verify-live. All 7 action references are SHA-pinned, and pages/id-token permissions are granted only in deploy. Gate tests check the pins, the workflow structure and the engine boundary, and 5 mutation checks confirmed they catch violations. `actionlint` 1.7.12 (Docker) reports no findings.
- **01-05 done: the site is live** at https://ainxtgendev.github.io/Eyeglass-Prescription/ (commit `364dd91`). Pages was enabled with `build_type=workflow`, and 36 commits were pushed as a fast-forward (the user approved the push). CI run 42211366016 passed build, deploy and verify-live. Checked from this machine: the curl commit grep found the hash, and the live Playwright run passed 14/14. In chrome-devtools on the live site (390 px mobile), −3,75 gives CT 1,8 mm, max edge 4,6 mm and 7,8 g; the timing median was 0,90 ms.
- DEPL-03 is complete (lint ran in CI). DEPL-01 stays open because of the favicon 404 below. DEPL-02: CI runs the full chain, but there was no demo branch showing that a failure blocks the deploy; the evidence is structural only.
- **01-06 done.** A material selection now offers 6 materials: CR-39, Trivex, PC, 1,60, 1,67 and 1,74, with cited Zeiss constants. The engine is checked against the Zeiss CR-39 thickness chart (143 rows, 0 transcription errors). The worst edge-thickness error is 0,069 mm and the worst centre-thickness error 0,072 mm, against a 0,20 mm limit. The thin-lens formula misses by 0,375 mm, which proves it would fail this check. 639 unit tests and 16 e2e tests pass. Favicon fix `39882ef`.
- **chrome-devtools (local):** at −6,00 the max edge goes from 6,3 mm with CR-39 to 4,1 mm with 1,74, and the weight from 9,7 g to 6,9 g. At +4,00, 1,74 (6,1 g) is heavier than 1,67 (5,9 g) because of its higher density. That is plausible. No console errors.
- **01-07 done.** Frame shapes Rund (48×44), Rechteckig, Panto and Pilot, each with A/B/DBL and a PD per eye. Decentration is (A+DBL)/2 − PD, and results are computed on the real outline. 699 unit tests and 18 e2e tests pass. ENG-05 is marked complete, but only proven for spheres; the oblique-cylinder test comes in 01-08.
- **chrome-devtools (local), −6,00 CR-39:** Rund 6,0 mm / 7,5 g; Rechteckig 7,9 mm / 9,5 g; Panto 7,0 mm / 8,2 g; Pilot 9,6 mm / 14,9 g (max edge / weight). Both eyes are identical. The decentration values are correct, e.g. rectangular (52+18)/2 − 32 = 3,0 mm. Rund shows its thinnest edge "oben, zur Nase". I checked whether that was a bug: it is correct, because the shape is a 48×44 oval and that point is closest to the optical centre (21,5 mm vs 22 mm). On a 48×48 circle the engine says "nasal".
- **01-08 done.** Cylinder support in the engine (minus-cylinder form) through a true torus back surface along the TABO axis. A ray-trace oracle traces through the finished lens and recovers Sph/Zyl/Achse within 0,001 dpt (300 + 100 random cases). A deliberately wrong thin-lens design is caught at 0,56 dpt. ENG-05 with an oblique cylinder on both eyes passes: the left lens is the right lens rotated 180° (not mirrored), within 1e-9 mm. ENG-01 to ENG-04 are complete, and 751 tests pass. No UI change, so no browser test.
- **01-09 done.** The page now takes Sph/Zyl/Achse per eye in both cylinder forms. A plus cylinder is converted automatically and both forms are shown in German. RX-02 and RX-03 are complete; 760 unit tests and 22 e2e tests pass.
- **chrome-devtools (local, 390 px):** for R −2,00/−1,50×45 the max edge is 5,1 mm at the upper temple side. For L −0,50/+1,50×135, displayed as "+1,00/−1,50×45°", the thickest edge is at the lower temple side and the thinnest at the upper temple side. Checked against TABO: both are physically correct. A missing or invalid axis shows a German error and blocks only that eye. No NaN, no horizontal scroll, no console error.
- **01-10 done.** Impossible and borderline lenses are now explained in German, with a title, an explanation and a tip; no raw codes remain. `BLANK_EXCEEDS_STOCK` and `OC_OUTSIDE_OUTLINE` are now raised and tested. Property and fuzz tests pass: the automatic base curve never fails on a buildable lens (0 cases out of 2,000 fuzz eyes), it is never thicker than Vogel, and the worst gap to brute force is 1,2e-6 mm. ENG-07, ENG-08 and L10N-01 are complete. 820 unit tests and 28 e2e tests pass.
- **chrome-devtools (local):** R −12/−6×10 in a 62×55 frame shows "Dieses Glas ist so nicht herstellbar", with a cause and the tip "smaller frame or 1,74". L +12 shows "Großes Rohglas nötig (≥ 87,5 mm, stock ≤ 75 mm)", 23,0 mm CT and 69,1 g. No raw code, no NaN, no console error.
- **01-11 Task 1 (gate + review):** the gate is green (820 unit, 28 e2e, coverage 97,4 %). The requirement trace has 21/21 rows with tests that really ran. **lens-critic: NEEDS WORK** (3 MAJOR, 0 BLOCKER), so the final push is held.
  - MAJOR-1: the automatic base curve makes plus lenses biconvex. Reproduced: +4 → D1 +2,75 / D2 **+1,23**. Plus CT comes out 0,09–0,48 mm too thin compared with Zeiss.
  - MAJOR-2: the ENG-09 measurement leaves out paint and the cache miss; the Grenzfall takes 6,5–11 ms on desktop against a 16,7 ms phone budget.
  - MAJOR-3: ENG-06 (sags), MAT-01 (Abbe) and MAT-02 (Expert view) have no plan that closes them.
  - User decision: **gap plan, then push**. Gaps are in `01-VERIFICATION.md`.
- **Gap planning (01-12 to 01-14, 01-11 now last).** User decisions: **D-A**, the automatic front curve may go up to +14 dpt (US4185897: high-plus series 12–16 D; the manual range stays 0…+10). **D-B**, a phone proxy with CPU throttling at 4×/6× before the push, which stops and asks if the Grenzfall fails.
- The plan checker passed on the second round. lens-critic said NEEDS WORK on both rounds. Round 2: with thinnest-only, 100 weak plus lenses got fronts up to +14 for at most 0,05 mm of gain, and the rescue bisection missed windows.
- **D-C (orchestrator, per the user's instruction "always use best practices"):** τ = 0,10 mm tie-break, meaning the flattest front within 0,10 mm of the thinnest (best form). This refines D-01. The bisection fix is also adopted. The planner is revising for the second time.
- **Gap plans:** lens-critic passed them on the third round. Its 9 MINORs were handed to the executors as binding additions.
- **01-12 done.** No automatic plus lens has a convex back any more; the front ceiling is +14; the D-C tie-break takes the flattest front within 0,10 mm. Checked myself: +2/+4/+6 CR-39 in 52×38 give D2 ≈ 0,00 (plano-convex), −4 is unchanged (D1 +0,50 / D2 −4,50), and +0,25 1,74 gives D1 +0,50. The automatic lens is 0,044–0,449 mm thinner than Zeiss, so the disclaimer now says "bis zu etwa 0,4 mm". The text "möglichst dünn" becomes "nahezu so dünn wie möglich (höchstens 0,1 mm dicker)". 973 unit tests and 30 e2e tests pass.
- **Decision (best practice):** the rare rescan pairs (0,07 % of eyes, about 20,6 ms per pair on desktop, e.g. +11,75 −5,25×5, rund 43×55/20, PD 27) are also timed and reported in the 01-14 phone proxy. New Grenzfall: +10,75 −1×89, 1,67, rechteckig 43×43/21, PD 36, 12,5 ms on desktop.
- **01-13 done.** Sags at 7 outline points and νe are now in the engine result (ENG-06, MAT-01). The page shows the Abbe number, the raw Vogel value with a clamp note ("+18,00, begrenzt auf +14,00"), and its own axis message. The MAT-01/MAT-02 texts were updated (+14, D-C, Expert-view clause → UX-02), and ENG-06, MAT-01 and MAT-02 are complete. 1010 unit tests and 36 e2e tests pass.
- **chrome-devtools (local):** +4 in 1,74 gives D1 +3,97 with the honest τ wording; the material line shows "Abbe-Zahl 32"; the axis error for "90,5" is the new message; the disclaimer says "0,4 mm". No NaN, no console error. Oddity: for +0,25 the Vogel comparison has no "damit wäre … dick" clause, so the result review should check it.
- **01-14 done.** Work and latency are now timed separately (median of 10 edits), with per-eye memo, at most one recompute per frame, three readouts and quiet diagnostics. 1022 unit tests and 44 e2e tests pass. **Phone proxy:** Lighthouse benchmarkIndex for this host is 2221 (high-end desktop), so 4× is the right proxy. At 4× the normal case takes 15,25 ms of work (passes; 6× fails), the Grenzfall 64,35 ms and the rescan pair 178,05 ms (both FAIL).
- **User decision: "Worker + RAIL target".** The next gap plan, 01-15, adds a Web Worker and restates ENG-09. I checked https://web.dev/articles/rail: process input in < 50 ms, visible response in < 100 ms, and feedback for actions > 50 ms. The page itself recommends Core Web Vitals (INP) over RAIL, so the INP threshold must be checked against its source.
- **01-15 planned** (`f8b01dd`), with 5 tasks:
  - a module Web Worker, latest-wins with a sequence id, one job at a time;
  - "rechnet …" after 50 ms with `aria-busy` and stale values marked in text;
  - a German error path and a sync fallback;
  - re-instrumentation and the 2×/4×/6× proxy on the worker path;
  - a decision gate.

  Restated ENG-09: main thread < 16,7 ms per task (the user's words: "under one frame"; RAIL's 50 ms only as the outer bound), a normal result within 100 ms, INP ≤ 200 ms ("good", checked on web.dev/articles/inp, applied strictly per edit), and in extreme cases "rechnet …" while the UI stays responsive. Plan checker and lens-critic are reviewing it.
- **01-15 review rounds.** Round 1: lens-critic NEEDS WORK with 4 MAJORs. It proved that CDP CPU throttling does not slow the worker (45→50 ms vs main 46→193 ms; worker target: "Operation is only supported for pages, not workers"). So the proxy measures only (a)/(b); (c)/(d) are estimates and the real phone decides. Round 2: the 4 MAJORs are resolved, with 3 new ones: CT is 1,8 mm for every minus lens, so the tests can't discriminate (use etmax/weight); a layout shift at 360 px; no "settled" signal. The third revision is running.
- **01-15 round 3:** lens-critic NEEDS WORK with 2 MAJORs (the coalescing test and the sync-no-autobench test could not fail). The orchestrator fixed both in the plan (`3a8d938`); lens-critic confirmed **PASS**. Its 12 MINORs were handed to the executor as binding additions. **01-15 execution has started.**
- **01-15 done.** Module Web Worker (latest-wins, the bench run by run, 10 s watchdog, sync fallback), per-eye "rechnet …" without layout shift, a `data-pending` settled signal, timing to after paint, ENG-09 restated (INP/RAIL). 1070 unit tests and 68 e2e tests pass, and the engine is unchanged.
- **Proxy:** 4× FAIL (a,b measured; c,d estimated). (a) reached 54,80 ms in the extreme run. **Diagnosis** (LoAF plus paced keystrokes, no code change): it is an artifact of the timing spanning several tasks. No LoAF frame was > 50 ms, and Event Timing max was 32 ms (INP "good" ≤ 200). What remains: a plain edit at 4× takes 14,5 ms median and 16,3 ms max, and frames reach 21–30 ms during fast typing. (b) passes at every rate; the (c)/(d) estimates pass.
- **User decision: "Phone decides".** The real phone in 01-11 decides; if it also misses, a small optimisation plan follows.
- **01-11 re-run (2026-11-07):** gate at e8139c4 green (1070 unit tests, 68 e2e, coverage 98,45 %); trace 21/21 rows, no mismatch. **lens-critic result review: PASS** (0 BLOCKER, 0 MAJOR). MINORs 1/3/4 fixed in `02bf4ff`; MINORs 2/5 accepted (phase 2).
- **Pushed** (user approval "please push it when finished", conditional on PASS): `364dd91..02bf4ff`, 86 commits. CI run 42348782420 passed build/deploy/verify-live. The live Playwright run passed 68/68 and the commit grep found the hash.
- **chrome-devtools live check:** 4 requests, all under `/Eyeglass-Prescription/` including the worker; no favicon request and no console error, so **DEPL-01 is complete**. `data-mode=worker`. R −4/−2×30 gives 7,3 mm / 8,5 g; L +4 gives D1 +3,95, CT 4,9 mm; +12 in 62×55 gives CT 38,3 mm, D1 +9,19, "Vogel +18 begrenzt auf +14" and "Großes Rohglas nötig". No NaN.
- **Real-phone measurement (Pixel, Chrome 156, live 02bf4ff, worker), ENG-09 complete.** Run 1 (slow edits plus fast typing): main thread median 7,40 ms, longest 30,10 ms; Event Timing 72 ms; result visible ≤ 53,6 ms. Run 2 (slow edits only, 2 s apart): **main thread median 5,45 ms, longest 12,80 ms** (< 16,7), result visible ≤ 27,3 ms, Event Timing 64 ms, "rechnet …" 2× (≤ 53,6 ms). (a)–(d) pass. The fast-typing value of 30,1 ms is recorded as a finding; it is the multi-task-spanning artifact known from the desktop diagnosis. Bench in the worker on the phone: normal 2,3 ms, Grenzfall 9,7 ms, rescan 25,3 ms.
- **DEPL-02 CI demo (user-approved):** branch `ci/gate-demo` with a deliberately failing test, run 42350539302: build failure (test:coverage failed with "expected 1 to be 2"), build/e2e/upload skipped, deploy and verify-live **skipped**. The branch was deleted and main is untouched. DEPL-02 complete.
- **Phase 1 complete:** 21/21 requirements, `01-VERIFICATION.md` status passed, `gsd-tools phase complete 01`.

### Open items
- Still missing from the user: the exact Pixel model and a typing impression (not blocking).
- gsd-tools warning (pre-existing, not phase 1): 9 v2 IDs (SHARE-01/02, INS-01..05, LANG-01, DATA-01) are missing from the REQUIREMENTS traceability table. Fix it when planning phase 2.
- **Changed requirement texts for the 01-11 manifest:** MAT-01 ("uses ne and density, exposes νe") and MAT-02 (+14, D-C, Expert view → UX-02).
- ENG-09: the planner projects the slowest case at about 57 ms with 4× throttling, against a 16,7 ms budget, so 01-14 will probably stop at its checkpoint. Then the choice is a Web Worker or restating ENG-09.
- ENG-09 worst case: the spec with the most iterations (+0,50/−0,50×81, 1,60, Panto 58×54/15) is not the slowest on desktop; +7,50/−5,75×148 takes 8,0 ms against 7,4 ms. Time both on the phone.
- Still pending: MAT-02 (needs the Expert view, phase 2) and ENG-06 (no sags in the result yet).
- After conversion there is no range check yet: +11 +3 becomes Sph +14 and is accepted. That is RX-04 in phase 2.
- The difference table in PITFALLS.md (Pitfall 5) was computed with the barrel instead of the tyre torus. With the tyre the real differences are at most 0,086 mm, not 0,39 mm. Only the orientation sentence was corrected; lens-critic should check it in 01-11.
- Pilot orientation (deepest on the temple side vs the nose side) is unverified, with no reference image. Decide in lens-critic 01-11.
- MAT-01 is not marked complete: the Abbe number is stored but not yet used. Decide in 01-11 / lens-critic.
- Cosmetic: the material labels are inconsistent ("(1,50)" vs "1,53" without brackets). Phase 2 (UI) will tidy them.
- `https://ainxtgendev.github.io/favicon.ico` returns 404, the only console error on the live site; Playwright headless doesn't see it. 01-06 adds an inline icon link.
- **Your action:** open the live URL on a real phone and note the model, the browser and the "Technische Angaben" median (an early ENG-09 data point).
- Errors still show a raw code (e.g. `Code BACK_SAG_UNDEFINED`); 01-10 adds German texts.
- The node bench (median 2,3 ms per pair) is slower than the browser measurement (0,8 ms). The phone measurement for ENG-09 comes in 01-11.
- The warnings `BLANK_EXCEEDS_STOCK` and `OC_OUTSIDE_OUTLINE` are not raised yet. Plans 01-07 and 01-10 add them.
- Smoke test 3 expects "Vogel" in `#result-od-basecurve`, but the disclaimer avoids saying "Vogel-Regel" (D-01). Check the wording in 01-03 and with lens-critic.
- 4 moderate dev-only npm advisories (minimatch via eslint 10), accepted as T-01-12.

### Next step
`/clear`, then `/gsd-discuss-phase 2` (lay-first German input, results, comparison, Expert view). Phase-2 backlog from phase 1: RX-04 range checks, MAT-03 manual base curve (range and convexity), UX-02 Expert view with base curve, lens-critic MINORs 2/5 (Vogel comparison), pilot orientation, phone layout (UX-03).

## 2026-11-07 — Phase 2 discuss, plan, execute (in progress)

### Done
- **Discuss:** user delegated all gray areas ("use best practices easy to use"); 02-CONTEXT.md D-01..D-39 (`eb47c8c`).
- **Research** (`287fbca`), **UI-SPEC** approved 6/6 (`a4c35d3`), pattern map, validation strategy.
- **Plans:** 15 plans; plan-checker PASS; **lens-critic plan gate PASS after 4 rounds** (`38dc549`). Key catches: "dickste Stelle" must be max(CT, edge) for plus lenses; manual-base-curve convex warning direction; aspheric re-solve must keep the back non-convex; axis 0/180 float tie in edge locations; L/R cause rule for strong myopes.
- **Executed 02-01..02-08** (not pushed): tolerant edge tie rule (engine), lay result cards + example + L/R sentence, Experten-Ansicht + two-column/phone bar, paper-shaped Rx table with message tiers / ± / mirror / tips, smart PD + temple stamp + shape cards, pipeline move, compare lane, always-visible material comparison, Vorher/Nachher comparison. Last gate: 1337 unit, 220 e2e green.
- ENG-09 4× proxy input frame max hovers at 16,4–17,5 ms vs 16,7 ms budget — judged in 02-14 (proxy) and 02-15 (real Pixel).

### Open items
- Desktop: sticky results column covers the disclaimer at page bottom (RES-06) — fixed in 02-09 extra task.
- `properties.test.js` MAT-02 monotonicity near its 60 s timeout under coverage — 02-09 extra task.
- Requirements still pending by design: RES-03 (cross-section overlay 02-13), UX-01 (remaining tips 02-10), FRAME-02 (rim depth 02-11), UX-02/UX-03 (later plans / real iPhone).

- **Executed 02-09..02-14** (not pushed): presets with inline confirm (RES-05), disclaimer no longer covered on desktop, Expert manual base curve + min thicknesses (MAT-03/04, UX-01 all 12 tips), aspheric front + rim depth (MAT-05, FRAME-02), custom material (MAT-06), cross-section with A/B overlay (ANA-01, RES-03), whole-page WCAG 2.2 AA axe matrix + keyboard flow (UX-04). Gate at 200634d: 1564 unit, 336 e2e green.
- **ENG-09 proxy findings (02-14):** 4× case A input frame max 19,5–19,9 ms (limit 16,7; phase 1 16,3) — ENG09-PROXY-1..4; (b) passes (≤ 98 ms). Real Pixel decides in 02-15.
- New open bug: a field message appearing on blur can shift the next control under the pointer, so the click is lost.

### Next step
02-15: gate, lens-critic result review, push approval (user), live + real-phone check (Pixel).

## 2026-11-07/08 — Phase 2 gate, push, live and Pixel check (complete)

### Done
- **lens-critic result review:** NEEDS WORK. The gap plans 02-16..02-22 fixed B1, M1, M2 and M3. In 02-22 the 4× proxy harness was made quiet (user: "Fix the measurement").
- **Push approved** ("Push now, fix typing after"). Two CI-only fixes followed:
  - font-independent phone layout (`66a9a68`, DejaVu metrics on the runner)
  - layout spec timing (`976629f`)
- Deploy run 42415734158 is green (build, deploy, verify-live). The live site serves `976629f`. Live e2e: 389 passed, 1 skipped.
- **Pixel 7 Pro / Android 17 / Chrome 156:**
  - ± works; no overflow; typing feels smooth.
  - ENG-09 (a) input frame max 27,4 ms (limit 16,7 ms; median 6,3 ms).
  - (b) 72 ms, (c) 56,2 ms and (d) all pass.
- **User accepted the speed** ("im satfied with the current speed"). ENG-09 is Complete with (a) accepted unmet, and lens-critic M4 is closed by acceptance. Phase 2 is complete (`0e5e9f9` and the close-out commit).
- New colourful README with badges (`d3667a5`).

### Open items
- Unverified on a phone: whether the sticky bar covers the focused L PD field on Android, and a TalkBack pass. Both are carried with UX-03 (Pending "Phase 2 + 3").
- Backlog:
  - MINOR-1: card and bar empty on incomplete entries such as "-" and "-4,".
  - MINOR-2: narrow bar test fixture, style.css:112 comment, 200 % text size.
  - m5–m7: example tag, lay note for thick lenses, shorter Simple view.
  - Engine property tests near their timeouts.

### Next step
`/clear`, then `/gsd-discuss-phase 3` (3D lenses and frame, thickness heatmap).

## 2026-11-08 — Phase 3 execution (in progress)

### Done
- **03-01** bevel split + front-surface lead (`bevelSplit`, `frontLeadMm`; Expert rim lines). The '1:2' default is a deliberate change from Phase 2 (t = D now shows D/6 at the back). Phone check (chrome-devtools, 412 px): Randtiefe 3,0 → "hinten 1,6 mm, vorne bündig", lead 0,5 mm. Randtiefe 10 → "passt", no lead. No overflow, no console errors.
- Orchestrator fix `5f796e2`: the disclaimer no longer says the facet position is not modelled. It now says the facet position is assumed.
- **03-02** Three.js import boundary + fixed-topology lens mesh. D-04(c) worst 0,0074 mm (nₑ ≥ 1,49, limit 0,01) and 0,0231 mm for custom nₑ < 1,49 (limit 0,025). The margin is tight; the scan covered axis 45 and DBL 14 only. Build 12,7 ms per lens (−10, 62×55).
- From wave 2 on, same-wave plans run in parallel worktrees (user request).

### Open items
- Tell lens-critic about the 0,0231 mm low-index margin in the result review.
- Commit 143a039 (03-01) does not build: an intermediate state, which matters only for bisecting.

- **Wave 2 in parallel worktrees:** 03-03 (frame + heat mesh) ∥ 03-04 (mesh worker). Clean merge; post-merge gate green (1718 unit, e2e 389/1 skipped).
- **03-05** lazy 3D view: glass lenses from the mesh worker; mesh watchdog now honours hidden tabs and late timers. Most e2e specs now run `without3d` (SwiftShader rendering blocks ~0,4 s per re-render). Only the view, layout and a11y specs keep the view on.
- **03-06** view states (no WebGL, load failure, blocked eye, empty eye); numbers first below 900 px (the view sits after the results). UI-SPEC load-failure string: "darunter" dropped.
- **03-07** frame in 3D (rims, bridge, temples); Technische Angaben show the drawn temple length plus the clamp note (110–160 mm, assumed, unsourced). Playwright screenshot at 412 px: the frame renders correctly, but the glasses are small (each lens ≈ 35 px).
- The chrome-devtools screenshot hangs once WebGL is mounted. Fallback: Playwright `locator('#view').screenshot()`.

### Open items (added)
- Default camera too far for judging thickness: decision passed to 03-09 (see below).
- 3 unidentified unit-test failures only when coverage and full e2e run at the same time (alone 1730/1730). Probably timeouts.
- View chunk 556 kB (Vite > 500 kB warning). Safari/Firefox retry of a failed chunk unverified. Phone users reach the 3D view only by scrolling until the 03-15 thumbnail.
- For lens-critic: e2e `without3d` trade-off, unsourced temple range, the 0,0231 mm low-index margin.

### Next step
03-08 (eye-chart backdrop, quality tiers), then 03-09 (camera presets + controls).
