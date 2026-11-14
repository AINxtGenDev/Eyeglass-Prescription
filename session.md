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

- 2026-11-14 user decision at the 04-13 checkpoint: **quick fixes, then push** (MAJOR 2 texture 2048 on phones, m1 rim note, m2 fullscreen note, m3 caption; MAJOR 1 accepted, the phone check decides); **rewrite the local history** to remove the sibling domain before the push; D-02 stays accepted.

- 2026-11-14 pre-push fixes (04-16): chart texture 2048² on phones / 4096² desktop (the source canvas cannot be released: three.js re-uploads it after a context loss), fullscreen Dickenkarte note points out of the fullscreen, rim note only when the drawn rim band is ≥ 12 px, caption and screen-reader text reworded ("So verändert diese Brille Größe und Form …").
- 2026-11-14 history rewrite done as decided: the sibling's custom domain is removed from every unpushed commit (filter-branch on origin/main..main; 122 commits, 14 merges kept, final tree byte-identical). Local backup branch `backup/pre-rewrite-2026-11-14` (never push it; delete after the live check). The SHAs cf93dd8/387d7b1 named above no longer exist.
- Pre-push gate at 679726c: lint, 2148 unit tests (99,6 % lines), builds, test:dist 21/1, **full e2e 689 passed / 0 failed**, live subset 323, pwa 20/1 skipped, SW_SELF_DESTROY false, dev-1.8.

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

## 2026-11-13 — Phase 4 planning and execution (local only, not pushed)

### Done
- `/gsd-plan-phase 4`: 15 plans in 9 waves; lens-critic plan review passed after five rounds (`04-LENS-CRITIC-R1…R5.md`). P0 feasibility trace fixed the field at 30° and the grid tiers (fein 6/1, mittel 8/2, grob 10/3 px).
- `/gsd-execute-phase 4 --auto`, waves 1–5 merged on `main` (10 of 15 plans: 04-01…04-09, 04-15):
  - Engine: reverse trace from the eye, spectacle magnification (15 mm eye point), warp grid with aperture classes and quadtree rim leaves.
  - Warp worker and client, stale-job guard, transfer of the warp buffers.
  - Offline: vite-plugin-pwa service worker scoped to `/Eyeglass-Prescription/`, "Aktualisieren / Später" banner with input handover, documented kill switch; separate `build:e2e` so the test hook never reaches production.
  - Durchblick (third view mode, also in Simple view): both lenses, size text per eye and direction, "Mit Glas | Ohne Glas", reference ticks, rim drawing from the quadtree, one-panel eye picker below 360 px, blocked/empty/failed/no-WebGL states, no computing while the view is off screen.
  - M3 hard gate (accepted SC1 decision): on-screen pixel tests for axis direction and eye swap pass, 106/0 vs oracle 103/0; flipped or mirrored pictures fail.
- Wave-5 gate on `main` (commit d0d22e7): lint, 2130 unit tests, both builds, test:dist 17/1 skipped, a11y 32/32, affected e2e 198 passed, pwa 5/5, live subset 323. chrome-devtools MCP pass at 320 and 412 px clean.
- Fixed after wave 5: the a11y keyboard-path test assumed nothing between the results and the 3D view; since 04-08 the "Darstellung" switch sits there by spec. Test updated (e62826e).

### Open items (for the lens-critic result review, details in `.planning/phases/04-refraction-view-offline/deferred-items.md`)
- Chart texture 4096² costs about 89 MB GPU memory (phones).
- "Grenzfall" prescription misses its time budgets under `BENCH_GATE=1` (fein 56 / mittel 17 / grob 13 ms vs 30 / 15 / 8); the automatic step-down in 04-10 is the mitigation.
- Rim check (M3 c) samples a different line than planned; the past-rim note can practically never appear on screen.
- −1,00 lens shifts the edge 2,99 px on the 400 px desktop column, just under the 3,0 px threshold.
- Coverage-run timeouts in `diagnostics.test.js` under heavy load (pass on an idle machine); watch the first CI run.

- Wave 6 (04-10) merged 2026-11-13: Durchblick grid starts at "fein" on desktops and "mittel" on phones; after two slow pictures in a row (> 200 ms) it steps down one tier and says so ("Durchblick · vereinfacht"), percentages never change. Measured: desktop step fein → mittel cuts rays 5336 → 3080; a rim case 25304 → 6856 rays and ~150 → 35 ms worker time. Gate: lint, 2134 unit tests, builds, test:dist 19/1 skipped, e2e 226 passed + 1 one-off timeout (layout "breakpoint change keeps the view", passed 6/6 on rerun under load), pwa 5/5, live 323. MCP at 412 px with 6× CPU throttling: start tier mittel, 109 ms per picture, no step needed, console clean.
- CI risk found by 04-10: the step-down guard is active in the e2e build, so slow runners could step ordinary tests down; 04-11 adds a test-only `?refguardoff` (absent from production) to close it.

- Wave 7 merged 2026-11-13: 04-11 (Durchblick in comparison mode: compared eye as A | B panels, one panel below 360 px; leak test 57 changes, GPU counts unchanged, one WebGL context; test-only `?refguardoff`) and 04-14 (banner "Neue Version verfügbar" keeps typed inputs incl. comparison; kill-switch rehearsal clears all caches incl. a stand-in sibling cache; read-only sibling check: no sibling on this origin uses a service worker or Cache Storage).
- User request 2026-11-13: app renamed to **Brillenglas-Simulator** (title, h1, manifest name, one message).
- Bug found in the wave-7 gate and fixed (5e3a2d4): a repeated "new version waiting" report could make "Aktualisieren" reload without the "Eingaben werden zurückgesetzt" warning when storage is blocked; pwa project 4/4 runs green after the fix.
- Privacy: 04-14 wrote a sibling site's custom domain (a personal name) into a code comment; removed from the files (fee39c5), but two local commits (cf93dd8, 387d7b1) still contain it in history. **Decide at the push checkpoint** whether to rewrite those local commits before pushing.
- Wave-7 gate: lint, 2138 unit tests, builds, test:dist 21/1 skipped, full e2e 650 passed + the one fixed failure, pwa 17/17, live 323. MCP at 412 and 320 px: new name shown, A | B Durchblick with "Vorher (A)" / "Nachher (B)", no doubled 3D captions, console clean.

- Wave 8 merged 2026-11-13: 04-12 (fullscreen info panel: in fullscreen the tip, Bild toggle and sizes, or the Dickenkarte legend, sit below the picture and never cover it; axe 0 violations in all new Durchblick and update-banner states). Gate on `main`: lint, 2138 unit tests, builds, test:dist 21/1 skipped, affected e2e 201 passed / 17 skipped, pwa 20/1 skipped, kill-switch gate rehearsed by 04-12. MCP at 412 px: canvas 412×550, panel 550–916, no sideways scroll; MCP screenshots hang while real fullscreen is on, so the pictures are Playwright's (320 and 1280 px, checked).
- Open from wave 8 (for 04-13 / lens-critic): page is 1 px too wide at 320 px with 150 % text (result cards' number column, phase-2 typography); fullscreen Dickenkarte note says "alle Werte stehen in der Tabelle" but the table stays hidden; the m4 low-corner state is only reachable with a forced layout in this font; `view-memory` buffer pool 11 vs 10 once under load.

- 2026-11-14, 04-13 Task 1 done (d07e16d version label **dev-1.8**, 56f55f4 gate/trace/review input). Full gate at d07e16d: lint, 2138 unit tests (99,6 % lines), builds, full e2e 684 passed / 0 failed, live subset 323, test:dist 21 (precache 1,0 MB), pwa live 3, perf 3/3. `BENCH_GATE=1` timing budgets still fail on the Grenzfall prescription (57 / 17 / 13 ms vs 30 / 15 / 8; ray counts pass), so `nyquist_compliant` stays false. New small findings: WebGL "GPU stall due to ReadPixels" warning at 412 px; at 1164 px the rim note shows while the rim band is almost black-on-black. 111 local commits, 135 files changed, not pushed. lens-critic result review and gsd-verifier running.

- 2026-11-14 phase-result review: **lens-critic PASS WITH FINDINGS** (0 BLOCKER, 2 MAJOR, 9 MINOR, none ship-blocking; MAJOR 1 = BENCH_GATE budgets red on the Grenzfall prescription, MAJOR 2 = 4096² chart texture never measured on a phone, suggested 2048 on phone tiers). gsd-verifier: human_needed, no gaps (9d6f9ab). Verdict recorded in 04-13-SUMMARY (724e6f4). Waiting for the user: push decision, the history rewrite of cf93dd8/387d7b1, and acceptance or fixing of the two MAJORs.

### Next step (resume here after /clear)
- Wave 9, 04-13 (Task 1 done, review done; next: user push decision): dev-1.8, full gate, lens-critic result review, **push only after user approval** (and the history decision above), live check and real-phone check.
