---
status: resolved
trigger: "3 e2e failures only in GitHub Actions run 42411012304 (commit 14c382e): layout.spec.js:59 [desktop]+[mobile] R Sph top 758 >= bar 720; worker.spec.js:195 [mobile] #disclaimer.y moved 24 px after the result"
created: 2026-11-07
updated: 2026-11-07
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "(1) In card mode the Rx header terms are a flex-wrap row whose row count depends on glyph widths (16 px/700); with DejaVu Sans PD no longer fits next to Achse and a 3rd 44 px row appears (+44), and the 14 px hint gains a 7th line (+21), pushing R Sph to 758 > 720. (2) #cmp-material-intro switches between the tie wording and the 'das dickere Glas' wording when R changes from -2 to -2,5; with DejaVu the two wordings wrap to 6 vs 5 lines, so everything below (#disclaimer) moves 24 px."
  confirming_evidence:
    - "ubuntu:26.04 + Playwright deps + fonts-dejavu-core reproduces R Sph 758.15625 exactly; without DejaVu all pass"
    - "thead 88 -> 132 px and #expert-hint 126 -> 147 px, sum 65 = 758 - 693"
    - "instrumented worker.spec.js:195: only #cmp-material-intro changes height (144 -> 120) besides its ancestors; text changes from tie to thicker wording"
  falsification_test: "after a deterministic 2x2 term grid (14 px/600 per UI-SPEC) and a reserved-height intro, the 3 tests still fail in the DejaVu container"
  fix_rationale: "a 2-column grid has exactly 2 rows for any font (term text wraps inside its 44 px row); invisible sizer copies of every intro wording in the same grid cell make the intro height the max over all wordings, so a wording switch never changes height in any font"
  blind_spots: "exact runner font list unknown (DejaVu inferred from exact numeric match); real phone fonts (Roboto, SF) not tested directly, only Noto and DejaVu"
next_action: none - resolved, confirmed fixed in CI run 42413430314 (build job)

## Symptoms

expected: layout.spec.js:59 R Sph top < summary bar top (local ~693 < 720); worker.spec.js:195 boxes unchanged within 0.5 px
actual: CI R Sph top 758.16 vs bar 720.41; CI #disclaimer.y differs by 24 px after the result (mobile only)
errors: "R Sph top above the summary bar top" Expected < 720.40625 Received 758.15625; "#disclaimer.y after the result" Expected <= 0.5 Received 24
reproduction: CI ubuntu-latest, npx playwright install --with-deps chromium, npm run test:e2e
started: first CI run after 02-14/02-15 changes; local 389/389 pass

## Eliminated

## Evidence

- timestamp: 2026-11-07
  checked: gh run view 42411012304 --log-failed; artifacts API
  found: exactly the 3 failures above, 386 passed, 1 skipped; no artifacts uploaded
  implication: error-context.md not available; must reproduce
- timestamp: 2026-11-07
  checked: fc-match sans-serif locally; style.css:27 font stack
  found: local sans-serif = Noto Sans; stack is system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif
  implication: on a runner without Noto Sans, a different fallback font is used

- timestamp: 2026-11-07
  checked: docker mcr.microsoft.com/playwright:v1.65.0-noble, CI=1, layout.spec.js + worker.spec.js
  found: 54 passed; container fc-match sans-serif and system-ui = WenQuanYi Zen Hei (50 fonts)
  implication: the official image is not the CI font environment; the ubuntu-24.04 runner has other fonts (likely DejaVu as fontconfig default)

- timestamp: 2026-11-07
  checked: CI log 'Set up job' and 'playwright install --with-deps' output
  found: runner Image ubuntu-26.04; fonts-liberation preinstalled; Playwright adds freefont, ipafont, wqy-zenhei, unifont, tlwg-loma
  implication: CI font set = runner image fonts + Playwright deps

- timestamp: 2026-11-07
  checked: ubuntu:26.04 container + host node 22.17.0 + npx playwright install --with-deps chromium; tests run with and without fonts-dejavu-core
  found: without DejaVu (sans-serif=WenQuanYi) 4 passed; with fonts-dejavu-core (sans-serif=DejaVu Sans) all 3 CI failures reproduce, R Sph top 758.15625 (identical to CI)
  implication: CONFIRMED the font hypothesis; DejaVu Sans (wide, tall line box) is the CI fallback for system-ui/sans-serif

- timestamp: 2026-11-07
  checked: diag.mjs/diag2.mjs at 360x780, host (Noto Sans) vs container (DejaVu Sans)
  found: #expert-hint 126 -> 147 px (6 -> 7 lines at lh 21 px); card-mode thead term row 88 -> 132 px (flex-wrap: 2 -> 3 rows of 44 px). Sum +65 = 758 - 693. Term widths Noto Sph 120/Zyl 113/Achse 117/PD 185 (row 2 = 117+16+185 = 318 of 328 px, 10 px slack); DejaVu 132/125/128/206 (128+16+206 = 350 > 328, PD wraps to a 3rd row). th renders 16 px/700; #expert-hint 14 px/lh 1.5
  implication: the term row's row count is font-dependent (fits locally by 10 px). UI-SPEC typography: column headers and field hints are 14 px, 600 for headers, line-height 1.4; card mode is a 2x2 grid (Sph | Zyl, Achse | PD)

- timestamp: 2026-11-07
  checked: instrumented copy of worker.spec.js:195 in DejaVu container, diff of all element heights before #disclaimer at b0 vs after the result
  found: only #cmp-material-intro (144 -> 120) and its ancestors change height; text tie wording ('beide Gläser gleich dick – gezeigt: das rechte Glas') -> 'das rechte Glas (das dickere Glas)'. Cards and #calc-status unchanged
  implication: value-dependent wording inside a paragraph changes its line count font-dependently; Noto wraps both to 6 lines by chance

- timestamp: 2026-11-07
  checked: after fix, diag at 360x780 host vs DejaVu container
  found: thead 88 px in both fonts (2x2 grid, 14 px/600, term text wraps beside the tip button); #expert-hint lh 1.4: 117.6 / 137.2 px; R Sph top 684.7 (Noto) / 704.3 (DejaVu) vs bar 720.4
  implication: header row height no longer font-dependent; 16 px margin with the widest tested font

- timestamp: 2026-11-07
  checked: DejaVu container, layout + worker + compare specs after both fixes
  found: 98 passed (previously the 3 CI failures reproduced in this container)
  implication: falsification test passed; fix addresses both causes

## Resolution

root_cause: font-metric-dependent wrapping. (1) card-mode Rx header terms use a flex-wrap row (2 or 3 rows of 44 px depending on glyph width) plus a long 14 px/lh 1.5 hint above the table; with DejaVu Sans (CI fallback for system-ui) R Sph lands at 758 > 720. (2) #cmp-material-intro height follows its value-dependent wording (tie vs thicker), 6 vs 5 lines with DejaVu, moving #disclaimer by 24 px.
fix: (1) style.css card mode: Rx header terms in a 2-column grid (Sph | Zyl, Achse | PD) at UI-SPEC 14 px/600/lh 1.4, term as block flex with nowrap so the text wraps beside the tip button (rows always 44 px); #expert-hint line-height 1.4 (UI-SPEC small text). (2) index.html/compare-view.js/style.css: #cmp-material-intro shares a grid cell with invisible (visibility:hidden) copies of all four wordings, so its height is the max over wordings in any font. Test comment in layout.spec.js updated with measured numbers (assertion unchanged).
verification: lint clean; vitest 1595/1595, coverage gate pass; build ok; e2e 389 passed / 1 skipped locally (Noto), in ubuntu:26.04 + Playwright deps + DejaVu (CI-equivalent), and in mcr playwright:v1.65.0-noble (WenQuanYi). Commit 66a9a68. CONFIRMED on GitHub Actions: run 42413430314 build job passed `npm run test:e2e` at 66a9a68 (orchestrator report, 2026-11-07).
files_changed: [src/ui/style.css, src/ui/compare-view.js, index.html, e2e/layout.spec.js]
