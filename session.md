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
- State: phases 1–3 complete, phase 4 not started. Live = dev-1.5 (footer checked 2026-11-11 after green run 43107142219): Rx card labels with the unit on its own line, aligned result values, readability pass (quick task 261111-s53: heading scale, 16 px explanations, reading width about 66 characters), 8 px column gap in the Rx card.
- Pixel check done 2026-11-11: user confirmed on the real Pixel that the bottom-bar thumbnail shows and works with the 3D view scrolled away (dev-1.2).
- Next command: `/gsd-discuss-phase 4` (Durchblick refraction view, mobile degradation, offline service worker with update prompt).
- Carry into phase 4 from `.planning/phases/03-*/deferred-items.md`: CI flaky reporting, fullscreen legend (MINOR 2), a11y.spec.js:215 timeout, `window.__eyeglassView` production gate (AR-03-04), real Pixel performance trace.
- Local testing (user 2026-11-11): lint + unit + build + only the affected e2e specs before a push; CI runs the full suite before deploy.
- Runner font check (2026-11-11): CI uses DejaVu Sans, wider than the local Noto Sans. Reproduce layout budgets locally with a fontconfig file that lists only `/usr/share/fonts/truetype/dejavu`: `FONTCONFIG_FILE=<file> npx playwright test e2e/layout.spec.js` (gave the exact CI value).
- CI note 2026-11-11: four runs failed at `playwright install --with-deps` (runner could not resolve the Ubuntu mirrors); a `||` fallback was tried locally and reverted because test/ci/workflow-structure.test.js forbids it.
- Rules: bump `version.js` (dev-1.6) with the next deployed change; lens-critic gate on the phase 4 plan and result; ask before every push.
