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

### Next step (resume here after /clear)
- State: phases 1–3 complete, phase 4 not started. Pushed 2026-11-12, check the footer for the live version: dev-1.6 (results column sticky from 480 px viewport height instead of 600 px, because the user's tablet in landscape, about 1164 × 593, got a long blank area below the inputs; result card labels centred) and dev-1.7 (Dickenkarte frames both lenses, user request: the two eyes often differ).
- dev-1.7 consequence, tell the user if asked: the picker 'Zahlen am Glas für' no longer moves the camera; on stages narrower than about 500 px (phone, 400 px results column, the user's tablet) the on-lens numbers do not fit next to two lenses, so the table-only note shows and the table lists both eyes. This amends lens-critic MAJOR 4 / D-21 by user decision (03-UI-SPEC.md, dev-1.7 amendment); no lens-critic run was done for it.
- Pixel check done 2026-11-11: user confirmed on the real Pixel that the bottom-bar thumbnail shows and works with the 3D view scrolled away (dev-1.2).
- Phase 4 context gathered 2026-11-13 (`.planning/phases/04-refraction-view-offline/04-CONTEXT.md`, committed locally, not pushed). No options were put to the user (best-practice rule); all decisions are Claude's and open to veto. Main ones: Durchblick is the wearer's view at true scale (small effect for weak prescriptions, shown with an undistorted surround, "Mit Glas | Ohne Glas" and percentages as text); both lenses shown, right lens on the right; third mode in the view switch, also in Simple view; camera fixed; automatic step-down with a note on slow phones; offline via vite-plugin-pwa with an "Aktualisieren / Später" banner that keeps typed inputs across the reload.
- Phase 4 UI-SPEC approved 2026-11-13 (`.planning/phases/04-refraction-view-offline/04-UI-SPEC.md`, commit c7a5252, local, not pushed). gsd-ui-checker APPROVED; lens-critic needed three passes (FAIL 2 BLOCKER/8 MAJOR → FAIL 2 MAJOR → PASS with 12 MINOR; N1–N2 applied, N3–N12 listed in the spec under "Carried to the Planner"). No options were put to the user; all choices are Claude's and open to veto. What changed against 04-CONTEXT.md, tell the user if asked:
  - The percentage is now a defined quantity: spectacle magnification (shape factor × power factor) at the entrance pupil, 15 mm behind the lens (12 mm vertex distance assumed + 3 mm). The 3 mm has only secondary sources so far; the copy always says "angenommener Wert". Shown as whole percent from 3 % up (−4,00 reads "etwa 6 % kleiner"), because the assumed distance alone moves the value by more than a decimal.
  - The Durchblick shows only the central field (30° half-angle, provisional), not the whole lens: towards the rim of minus lenses there is no valid light path (total reflection) and the old spec would have drawn a false chart there. The rim jump from D-02 is therefore usually off-screen; fixed reference ticks on the panel edges, the "Mit Glas | Ohne Glas" blink and the text replace it. **Accepted by the user (2026-11-13, explicit "accept the criterion-1 decision"):** ROADMAP criterion 1 (cylinder visibly distorts) is judged by blink + ticks + text, with on-screen pixel tests for axis direction and eye swap as a hard gate in 04-08; along a panel's short side a 1 dpt cylinder moves the picture only about 1,7 px (3,4 px along the long side).
- SC1/D-02 reported to user 2026-11-13: accepted explicitly by the user the same day; M3 on-screen pixel tests are the hard gate in 04-08; 04-13 asks for confirmation only.
  - Weak lenses (below about ±1,00) get a note that the difference is hardly visible in the picture.
  - With a cylinder the text gives the two directions (senkrecht/waagrecht/schräg with degrees), no single overall percentage.
  - Update banner: "Später" is kept in memory only; the typed inputs are handed over in every open tab that the update reloads (D-21 said "only on click"); the banner is a labelled region with a separate announcement line (D-20 said `role="status"`).
  - All px and percent values in the spec come from scratch traces, not production code, and are marked vorläufig. The first planner task P0 (feasibility trace over the Rx/frame range) recomputes them and fixes the field angle; a separate citation task fixes the 15 mm.
- Standing rule added 2026-11-13: `/gsd-ui-phase` also runs lens-critic on the UI-SPEC; session.md is updated in every GSD workflow, not only during execution.
- Phase 4 planned (15 plans, lens-critic plan review passed) and executing via `/gsd-execute-phase 4` (2026-11-13, local only, not pushed): waves 1–5 merged, 10 of 15 plans done (04-01…04-09 + 04-15); wave 6 (04-10 automatic grid step-down) next, then 04-11 + 04-14, 04-12, 04-13 (dev-1.8, push needs user approval). Open for the lens-critic result review: `.planning/phases/04-refraction-view-offline/deferred-items.md`.
- Folded into phase 4 as F-01..F-06 (04-CONTEXT.md): CI flaky reporting, fullscreen legend (MINOR 2), a11y.spec.js:215 timeout, `window.__eyeglassView` production gate (AR-03-04), real Pixel performance trace, m4/m5.
- Local testing (user 2026-11-11): lint + unit + build + only the affected e2e specs before a push; CI runs the full suite before deploy.
- Runner font check (2026-11-11): CI uses DejaVu Sans, wider than the local Noto Sans. Reproduce layout budgets locally with a fontconfig file that lists only `/usr/share/fonts/truetype/dejavu`: `FONTCONFIG_FILE=<file> npx playwright test e2e/layout.spec.js` (gave the exact CI value).
- CI note 2026-11-11: four runs failed at `playwright install --with-deps` (runner could not resolve the Ubuntu mirrors); a `||` fallback was tried locally and reverted because test/ci/workflow-structure.test.js forbids it.
- Rules: bump `version.js` (dev-1.8) with the next deployed change; lens-critic gate on the phase 4 plan and result; ask before every push.
