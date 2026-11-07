# Eyeglass Prescription — 3D Brillenglas-Simulator

A browser-based 3D simulator that turns an eyeglass prescription (Brillenrezept) and a frame choice into physically computed lens geometry: centre and edge thickness, surface curvature and weight. It shows the glasses in 3D.

It is built for people holding a paper prescription who want to know: *"How thick and heavy will my lenses be, and does a higher index or a smaller frame help?"* It also gives opticians and students exact numbers and cross-sections.

- **Website (German):** https://ainxtgendev.github.io/Eyeglass-Prescription/
- **Status:** phase 1 complete (2026-11-07): live German page computes thickness and weight per eye from a full Sph/Zyl/Achse prescription, for 6 materials (checked against Zeiss data) and 4 frame shapes; calculation runs in a Web Worker and was checked on a real phone. Next: phase 2 (lay-first input, results, comparison, Expert view)

## Planned features (v1)

- Prescription entry laid out like the paper Rx (R/L × Sph, Zyl, Achse, PD), with comma decimals, plus-cylinder conversion and missing-PD handling
- Frame shapes (Rund, Rechteckig, Panto, Pilot) with boxing dimensions, plus reading the frame stamp (e.g. `52□18 140`)
- Materials CR-39 1.50, Polycarbonat 1.59, 1.60, 1.67, 1.74 with sourced index and density values
- An optics engine using exact formulas, with tests: thick-lens back surface, true toric surface, decentration, centre thickness solved from minimum-thickness limits
- A plain-German summary and material/frame comparisons in mm and g
- An expert view with base curve, thickness limits, an aspheric option and a 2D cross-section
- 3D lenses and frame with a thickness heatmap
- A "Durchblick" view that ray-traces through the real lens surfaces
- Offline use after the first visit

Educational visualization only, not a substitute for an optician.

## Tech

Static site: HTML, CSS, JavaScript (ES modules), Three.js, Vite and Vitest. GitHub Actions deploys to GitHub Pages; failing tests block the deploy.

## Project docs

- [`idea.md`](idea.md): corrected specification
- [`.planning/PROJECT.md`](.planning/PROJECT.md): project context and decisions
- [`.planning/REQUIREMENTS.md`](.planning/REQUIREMENTS.md): v1 requirements
- [`.planning/ROADMAP.md`](.planning/ROADMAP.md): phases
- [`.planning/research/`](.planning/research/): research (stack, features, architecture, pitfalls)
- [`session.md`](session.md): session log

Planned with [GSD](https://github.com/gsd-build/get-shit-done). Every phase is reviewed by the `lens-critic` agent.
