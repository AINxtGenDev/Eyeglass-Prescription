# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## ci-e2e-font-layout — e2e layout tests fail only in CI because of fallback font metrics
- **Date:** 2026-11-07
- **Error patterns:** CI only, layout.spec, worker.spec, disclaimer moved, R Sph top, summary bar, DejaVu Sans, font, wrap, line count, px
- **Root cause:** font-metric-dependent wrapping: card-mode Rx header terms in flex-wrap (2 vs 3 rows) and #cmp-material-intro height following value-dependent wording; DejaVu Sans on the CI runner wraps differently than local Noto Sans.
- **Fix:** 2-column grid for header terms at 14 px/600/lh 1.4; #cmp-material-intro shares a grid cell with invisible copies of all wordings (height = max over wordings).
- **Files changed:** src/ui/style.css, src/ui/compare-view.js, index.html, e2e/layout.spec.js
---

