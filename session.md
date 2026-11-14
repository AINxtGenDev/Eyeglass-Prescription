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

- 2026-11-14 pushed 47bb4e2..3732224 (approved). CI run 43582107410 **failed in build** (deploy skipped, live stays dev-1.7): view-ref item 2 (plano Mit = Ohne lattice) read 153 vs 163 at a letter-band point with the CI font (DejaVu); view-controls D-29 was flaky only. Test fixed to skip the letter band like items 12/25; 4/4 local. Waiting for the user's OK to push this test-only fix.

- 2026-11-14 **phase 4 is live as dev-1.8 (55842a0)**. The second CI run (43590974743) passed build, deploy and verify-live. Live checks passed: commit and version in the HTML, manifest scope, the live e2e subset (323) and live pwa (3), and an MCP check at 412 px (Durchblick, worker scope, "Offline verfügbar", the offline reload recomputes, clean console). The backup branch with the old history was deleted and pruned locally.

### Next step (resume here after /clear)
- Real-phone check (04-13 Task 3 step 4, F-05) by the user on the live site; then mark REF-01, REF-02 and OFF-01 in REQUIREMENTS.md according to the evidence, close phase 4 (ROADMAP and STATE), and delete the empty `.claude/worktrees/` leftovers.
