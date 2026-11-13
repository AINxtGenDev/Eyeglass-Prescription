# Phase 04 deferred items

## From the lens-critic plan review, round 1 (2026-11-13, 04-LENS-CRITIC-R1.md MINOR 11)

- **Older test query switches ship in production (out of scope for phase 4).** Seven test-only
  switches from phases 2–3 are read from `location.search` in the production bundle. Anyone can turn
  them on by adding the query string to the live URL. Evidence: `grep -rnE` over `src/` (non-test
  `.js`) at commit f9c55f8:
  - `thumbguardoff`: `src/ui/view/view.js:154`
  - `failframe`: `src/ui/view/view.js:163–167` (`new URLSearchParams(location.search).get('failframe')`)
  - `perfmarks`: `src/ui/view/view.js:161`, `src/ui/pipeline.js:51`, `src/ui/main.js:61`, `src/ui/timing.js:24`
  - `nowebgl`: `src/ui/view/scene.js:97`
  - `cmpdelay`: `src/ui/pipeline.js:497`
  - `msgprobe`: `src/ui/pipeline.js:396`
  - `calloutsoff`: `src/ui/view/labels.js:84`

  Related (not a query switch, same kind of gap): `window.__eyeglassNo3d` is read in production at
  `src/ui/pipeline.js:230`; it is set only by an e2e init script.

  Why it is deferred: phase 4 gates only the new hooks (`__eyeglassView` F-04, `refdegraded`). The
  gate it creates can cover these: `import.meta.env.MODE !== 'production'` around each read,
  `test/dist/hooks.test.js` `HOOK_STRINGS` extended with the seven names, and
  `test/ci/env-gates.test.js` `ALLOW_ENV` extended with the files (04-02). Caveat for the later
  plan: the live subset and the `perf` project may depend on some of them (`perfmarks` in the perf
  project, `nowebgl` in the no-WebGL specs), so each switch needs a check of which build its specs
  run against before it is gated.

## From 04-15 (2026-11-13, out of scope: files not touched by 04-15)

- **Engine grid test times out under `--coverage` at load average 8–11.** `npm run test:coverage` in the
  04-15 worktree (three parallel executors on 8 cores, start 13:13:52) gave 1905/1906. The one failure:
  `src/engine/diagnostics.test.js:206` (ENG-07 extremes grid) `Test timed out in 120000ms`, after 147 s.
  An earlier 04-15 run reported 2 failures, but its log was in a scratchpad file shared with other
  worktrees, so it is not used as evidence. The same suite without coverage passed 1906/1906 at load
  11–14 (`npx vitest run --project unit`). 04-15 changes no file under `src/`. This looks like CPU
  contention, not a logic failure. It was not "fixed" by raising the timeout (04-15 rule). Re-run
  `npm run test:coverage` on an idle machine before the push in 04-13.

## Orchestrator notes during execution (2026-11-13)

- **White band in a 320×640 screenshot (04-06).** Playwright screenshot `04-06-320x640-ready.png` shows a white band across the top, over the "Erneut messen" button. Nothing in `src/ui/style.css` is fixed or sticky at the top at that width (only `#summary-bar`, fixed at the bottom; `.col-results` is sticky only at ≥ 900 px), so it is probably a capture artifact. Re-check in the chrome-devtools MCP during the 04-08 D-30 pass.
- **Durchblick time budgets (04-05).** With `BENCH_GATE=1` the Grenzfall Rx misses the UI-SPEC budgets (combined medians fein 56,4 / mittel 17,1 / grob 12,7 ms against 30 / 15 / 8 ms, load 0,4–2,1); the rim case exceeds the normal budgets at the 320 panel (fein ~41 ms, grob 8,2 / 9,2 ms) and at the 639×800 fullscreen panel (all tiers). Ray-count and monotonic gates pass. For the lens-critic result review in 04-13.
- **Coverage timeout under load.** `src/engine/diagnostics.test.js` ("ENG-07 extremes grid", "MAT-02 optimality sample") exceeds its 120 s limit under coverage at load ≥ 8; on an idle machine the full coverage run passed after waves 1, 2 and 3 (1900, 1961, 2045 tests). Watch the first CI run.
- **Wave-4 MCP pass (orchestrator, 2026-11-13, 412×915×2,6 mobile, production build 20a8725).** Durchblick reachable via the view-mode switch; `#view[data-pending]` reaches ''; badge "Durchblick · berechnet"; size block both directions per eye (example Rx OS −2,50/−0,75×170: 80° etwa 5 % kleiner, 170° etwa 4 %, consistent with the stronger meridian at 80°); canvas aria-label switches to the Durchblick text after the 500 ms debounce; service worker scope `/Eyeglass-Prescription/`, page controlled; offline line shown; `window.__eyeglassView` undefined; no horizontal overflow; console clean. Screenshot capture in the MCP times out on the WebGL page, so visual review used 04-08's Playwright screenshots (412×915 −4,00 and −2,00/−2,00×30: minification toward the corners, oblique shear mirrored between eyes, pills and badge legible).
- **For lens-critic (04-08):** M3 (c) samples 3,5 squares toward the temple with a pilot frame A 40 / B 30 / DBL 14 / PD 40 instead of half a square right of centre (no valid frame puts a one-sided rim on the planned line); the warp sync-fallback handler is imported statically instead of dynamically (keeps parity without widening `PARITY_ALLOW`); the 4096² chart texture costs about 89 MB GPU memory with mipmaps — revisit for phones in 04-10; new copy keys `tech.ref.formulaSource`, `tech.ref.source.cite`, `{side}` in `view.ref.side.one`/`.compare`.
- **From 04-09 (out of scope, not fixed): `e2e/a11y.spec.js` "D-29 keyboard path through the view" fails at 320×640 on both projects** — `expected "#view-stage", received "input"` for the stop right after the last focusable of `section#result`. Below 900 px the "Darstellung" radios (`#view-mode`, visible in Simple view since 04-08 D-09) now sit between `#result` and the stage, so the test's 03-06 assumption no longer holds. 04-09 adds no focusable before the stage (`#view-ref-eye` is inside `#view-ref`, after it). The test expectation (or the order) needs a decision: probably "the stage after the Darstellung radios". 176 other view/a11y/layout tests passed in the same run.
  - **Resolved by the orchestrator after the wave-5 merge (2026-11-13):** cause confirmed as 04-08 (fd85570 removed the expert tag from the Durchblick option, so `fieldset#view-mode` is visible in Simple view); the order matches 04-UI-SPEC "DOM inside #view" (switch before the stage). The test now allows exactly one `#view-mode` stop between `section#result` and the stage (commit "test(04-09): D-29 keyboard path …"); a11y.spec 32/32. The wave-4 gate missed it because it did not run a11y.spec; from now on the post-merge gate includes a11y.spec whenever a plan touches `#view` markup.
- **For 04-14 (from 04-07):** pass `formValid()` and `currentCompareConfig()` from `main.js` into the handover save call (otherwise a half-typed invalid input is reported as lost after the update); restoring a comparison moves focus to `#cmp-diff` at load; a restored lens-height B can lose its "geschätzt" note.

## From 04-10 (2026-11-13, not fixed: outside the plan)

- **Durchblick guard vs. a slow CI runner.** The guard is live in dist-e2e. Natural SwiftShader samples at fein, 1280 × 800, were 73–100 ms on a quiet host and 122–176 ms during the full batch (load ~7). Two counted edits in a row above 200 ms on a slower runner would step a normal test session down. Tests that expect "Durchblick · berechnet" after edits (`lens()` helper, retry test) would then fail. If CI shows this, add a MODE-gated guard-off init flag for the non-guard specs, like `?thumbguardoff`, and add its name to HOOK_STRINGS / ALLOW_ENV.
- **axe in the degraded state is not in `e2e/a11y.spec.js`** (UI-SPEC a11y list: "degraded note shown (forced via the gated test hook)"). 04-10 ran axe ad hoc with `?refdegraded` at 320 × 640 and 412 × 915: 0 violations. a11y.spec.js was not in 04-10's files; add the state there (04-13).
- **Programmatic requests carry `performance.now()` as inputTs** (main.js handover/start), not null. They cannot become counted samples (warm-up exclusion and one sample per t0), but main.js could pass null if a stricter reading is wanted.

## From 04-11 (2026-11-13, not fixed: outside the plan or for a decision)

- **Page buffer-pool counter grows in the Durchblick leak test.** `e2e/view-memory.spec.js` "Durchblick mode switches do not leak": over 57 changes `allocs().page` went 10 → 12 (worker 0 → 0) while geometries (30), textures (7), programs (14) and the WebGL context count (1) stayed equal. These are CPU mesh buffer sets (lenses.js pools), not GPU resources; the plan's leak criterion is renderer.info.memory plus one context, so the test does not assert the pool. Likely cause: the deferred re-mesh in Durchblick (04-09 M4) runs when the stage leaves the screen or the mode is left, and a following input can overlap it, which grows the pool by design (03-15: "the pools grow to the input rate"). Not proven bounded by a longer run; check in 04-13 whether repeating the sequence grows it further.
- **`e2e/a11y.spec.js` has no "Durchblick in a comparison" axe state** (UI-SPEC a11y list). 04-11 ran axe ad hoc in the A/B state (see 04-11-SUMMARY); a11y.spec.js was not in 04-11's files. Add it in 04-13 together with the degraded state from 04-10.
- **Other specs that enter the Durchblick still run with the live guard** (`view-fullscreen.spec.js`, `ref-live.spec.js`, `a11y.spec.js`, `view.spec.js`). They can use `guardPage(test, { view: true, search: '?refguardoff' })` if CI shows step-downs there; ref-live runs against dist, where the flag does not exist by design.
- **For lens-critic (04-11):** the single A/B panel below 360 px uses `view.ref.side.one` and the aria layout 'one' (the compare strings say "links Vorher (A), rechts Nachher (B)", which is false for one panel); PD is shared Rx, so NEW-7's B runs at PD 40, not the default 32; the A-pending panel shows `view.ref.loading` as a centred pill (no new copy key).
## From 04-14 (2026-11-13, not fixed: outside the plan or unverified)

- **BLAST RADIUS sentence over-counts the origin.** vite.config.js still says ainxtgendev.github.io "serves five Pages projects". The 04-14 check found four Pages sites (`gh api 'users/AINxtGenDev/repos?per_page=100'` with has_pages: Eyeglass-Prescription, interior-design, simplify_llm, testing). `gh api repos/AINxtGenDev/workflow` returns 404, and https://ainxtgendev.github.io/workflow/ returns 404. interior-design is served from its custom domain (Pages cname, the github.io path returns 301), so it is a different origin. The plan allowed only the result line to change, so the sentence was left as it is; correct it in 04-13. The result lines below it are accurate.
  - **Resolved by the orchestrator 2026-11-13:** sentence corrected (three projects on this origin, one on its own custom domain, one absent); the custom domain name is no longer written in the repo files.
- **A kill deploy probably shows "update.done.other" once (unverified).** The destroyer's activation replaces the controller of every open tab, so the 04-07 controllerchange rule fires in a tab that runs the old build and reloads it with its handover (origin 'other'). After that reload the kill build's main.js restores the inputs and shows „… geladen, weil sie in einem anderen Fenster gestartet wurde“. The inputs survive, which is good, but the reason in the sentence is wrong for a kill. The rehearsal did not assert the banner text after the kill. Decide in 04-13 whether a kill build should show no confirmation (for example `__SW_KILL__` in update.js start()).
- **The view-ref load flake reappeared in the kill gate.** `e2e/view-ref.spec.js:1147` item 25 (a)–(d) failed once in the full `npm run test:e2e` at load average 22–24 (badge „Durchblick · vereinfacht“, guard step-down). The same test passed alone straight afterwards, at load 8.7. This is the 04-10 item "Durchblick guard vs. a slow CI runner"; the spec belongs to 04-11.
