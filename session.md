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

### Open items
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
Plan 01-11: full gate, requirement trace and lens-critic review; then the final push if PASS; then the real-phone measurement (ENG-09).
