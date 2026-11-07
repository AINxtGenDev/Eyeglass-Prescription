---
phase: 02-lay-first-german-input-results-comparison
plan: 15
subsystem: phase gate
tags: [phase-gate, requirement-trace, lens-critic, UX-03, UX-04, RX-01, ENG-09]
requires: [02-14]
provides:
  - "Full gate green at HEAD 68c4e63 (npm ci, lint, test:coverage, build with GITHUB_SHA, test:e2e)"
  - "24-row phase-2 requirement trace, each row >= 1 passing and 0 failing tests"
  - "02-VALIDATION.md: Task IDs, statuses, nyquist_compliant: true, wave_0_complete: true"
affects: [.planning/phases/02-lay-first-german-input-results-comparison/02-VALIDATION.md]
tech-stack:
  added: []
  patterns: []
key-files:
  created:
    - .planning/phases/02-lay-first-german-input-results-comparison/02-15-SUMMARY.md
  modified:
    - .planning/phases/02-lay-first-german-input-results-comparison/02-VALIDATION.md
decisions:
  - "UX-02 and UX-03 stay Pending although their trace rows pass: UX-02 needs the phase-3 heatmap, UX-03 needs the phase-3 lens view to stay visible while editing (plus the real-phone check in Task 3)"
  - "Trace rows whose test titles carry no requirement ID were run at file level (the spec or test file named in the 02-VALIDATION map); they are marked 'file' in the table"
metrics:
  duration: "Task 1 without lens-critic: about 16 min (16:31–16:47 UTC)"
  completed: "DRAFT — Task 1 done except step 4; Tasks 2 and 3 not started"
status: draft
---

# Phase 2 Plan 15: Phase gate, requirement trace and lens-critic review — Summary (DRAFT)

**Status: draft.** Task 1 is done except step 4 (the orchestrator runs lens-critic and inserts the review below). Task 2 (push approval) and Task 3 (push, live check, phone checks, REQUIREMENTS.md update) have not started. Nothing has been pushed.

**Watch first:**
- The ENG-09 proxy has four open findings (ENG09-PROXY-1…4). The 4× case A input frame is 19,5–19,9 ms, above the 16,7 ms limit. Only the Task 3 phone check can settle ENG-09 (a)/(c) with the comparison running.
- A field message that appears on blur can move the control below the field, so the click is lost (02-14). This is an open usability defect on a lay-first page. It is not fixed and lens-critic should weigh it.

## Guards (step 1)

- 02-01-SUMMARY.md … 02-14-SUMMARY.md exist; `git log --oneline` lists a `docs(02-NN)` commit for each of 02-01…02-14.
- HEAD: `68c4e635e75d5332539d3302f813d389944066a9` (`68c4e63 docs: session log — 02-09..02-14 executed, ENG-09 proxy findings`).
- origin/main: `12219a5204efb70e885b9cf7d7829ff8c77f71b2` (phase-1 completion commit).
- Both 02-14 proxy lines are present (02-14-SUMMARY.md lines 164 and 166) and are copied verbatim:

Proxy (ENG-09 regression, phase 2): 4× (a) case A max 19,90 ms (runs 19,90 / 19,50 / 19,80) vs 16,30 ms in 01-15; (b) worst 97,90 ms (runs 97,90 / 67,70 / 82,20) vs 57,10 ms in 01-15, pass (≤ 200 ms)

Proxy findings (ENG-09): ENG09-PROXY-1, ENG09-PROXY-2, ENG09-PROXY-3, ENG09-PROXY-4

| ID | Rule (absolute) | Measured (02-14) |
|---|---|---|
| ENG09-PROXY-1 | 4× case A input frame (main thread incl. rendering) ≥ 16,7 ms | max 19,90 / 19,50 / 19,80 ms in all 3 runs (median 15,65 / 15,60 / 16,10) |
| ENG09-PROXY-2 | 4× case B input frame ≥ 16,7 ms | max 21,00 / 19,30 ms in runs 1 and 2; run 3 16,00 ms (below) |
| ENG09-PROXY-3 | any 1× input frame ≥ 16,7 ms | 1× extreme run (keystrokes during the rescan bench) 19,80 / 19,60 / 20,70 ms; case A/B at 1× ≤ 4,20 ms. Not re-diagnosed as the 01-15 multi-task artefact |
| ENG09-PROXY-4 | trend: 4× case A input frame max more than 2 ms above 16,30 ms | +3,20 / +3,20 / +3,50 ms |

## Full gate (step 2), run unpiped into logs at HEAD 68c4e63, 2026-11-07 16:31–16:38 UTC

Sequence: `npm ci; npm run lint; npm run test:coverage; GITHUB_SHA=$(git rev-parse HEAD) npm run build; npm run test:e2e`, each step's exit code appended to its log.

| Step | Exit | Real output (tail) |
|---|---|---|
| `npm ci` | 0 | `added 157 packages, and audited 158 packages in 1s` · `4 moderate severity vulnerabilities` (pre-existing, lockfile unchanged in phase 2) |
| `npm run lint` | 0 | `> eslint .` (no findings) |
| `npm run test:coverage` | 0 | `Test Files 34 passed (34)` · `Tests 1564 passed (1564)` · `Duration 189.26s` · Statements 98.34 % (831/845), Branches 96.52 % (389/403), Functions 100 % (82/82), Lines 99.15 % (706/712) |
| `GITHUB_SHA=… npm run build` | 0 | `vite v8.3.6` · `✓ 48 modules transformed` · `dist/index.html 42.52 kB` · `dist/assets/index-B3fb_H_B.js 125.89 kB │ gzip: 43.43 kB` · `dist/assets/engine.worker-D73Rly2A.js 19.31 kB` · `✓ built in 136ms` |
| `npm run test:e2e` | 0 | `336 passed (2.0m)` (desktop + mobile projects; no failed, no flaky) |

Coverage per engine file (v8): evaluate.js 98.34/98.37/100/97.89; metrics.js 98.33/95.55/100/100; power.js 96.42/88.88/100/100; profile.js 97.87/93.61/100/100; sag.js 92.59/87.5/100/100; solve.js 100/97.95/100/100; trace.js 92.75/81.81/100/93.84 (stmts/branch/funcs/lines).

The build embeds the commit: `grep -c 'content="68c4e63"' dist/index.html` = 1.

Informational benches, `npx vitest run test/bench/recompute.test.js test/bench/compare.test.js` (2 files, 5 tests passed):
- normal pair: median 3,122 ms, p95 3,486 ms (50 runs)
- normal pair, outline-cache miss: median 3,908 ms, p95 4,348 ms
- Grenzfall pair: median 17,497 ms, p95 33,896 ms
- compare lane NORMAL 6 materials × 2 eyes: median 19,444 ms, p95 22,815 ms (50 of 50 runs)
- compare lane GRENZFALL 6 materials × 2 eyes: median 87,995 ms, p95 92,986 ms (50 of 50 runs)

Quick-run latency for the sampling contract: `npm test` 46,94 s wall (1564 tests).

### Hygiene checks

| Check | Command | Result |
|---|---|---|
| references/ not tracked | `git ls-files references \| wc -l` | 0 |
| nothing from references/ or .planning in dist | `find dist -path '*references*' -o -path '*.planning*'` | (empty) |
| no "Stärke" | `grep -c "Stärke" src/i18n/de-AT.js` | 0 |
| no innerHTML/outerHTML/insertAdjacentHTML | `grep -rn "innerHTML\|outerHTML\|insertAdjacentHTML" src/ui \| wc -l` | 0 |
| engine imports no three | `grep -rlE "from 'three" src/engine \| wc -l` | **1, see note**; excluding test files: 0; `grep -rnE "^\s*import .*from 'three" src/engine` = 0 |
| no storage APIs | `grep -rn "localStorage\|sessionStorage\|indexedDB\|document.cookie" src --include=*.js \| grep -v test \| wc -l` | 0 |
| no inline styles | `grep -rn 'style="' index.html \| wc -l` | 0 |
| CSP | `grep -c "style-src 'self'" vite.config.js` | 1 |
| exact-CSP e2e | `e2e/worker.spec.js:41` "engine runs in a module worker under the sub-path (ENG-09)" asserts the meta CSP equals the constant, with no `securitypolicyviolation` | passed on desktop and mobile |

Note on the three check: the plan's literal command prints 1. The one hit is `src/engine/boundary.test.js` lines 21 and 23. They are source *strings* that the boundary test feeds to ESLint to prove the `no-restricted-imports` rule rejects `three` in the engine. They are not imports. No engine module imports three.

## Commit manifest (for Task 2)

- `git log --oneline origin/main..main | wc -l` = **80** commits (eb47c8c `docs(02): capture phase context` … 68c4e63), plus the docs commit from this task (81 in total).
- `git diff --stat origin/main..main`: **106 files changed, 21820 insertions(+), 1091 deletions(-)**.
- Outside `.planning/`: 38 added, 29 modified files in `src/` (state, ui, engine, i18n), `e2e/`, `test/bench/`, `index.html`, `session.md`. Share by files changed (`--dirstat=files`): .planning/phases/02 33,9 %, src/state 16,9 %, src/ui 15,0 %, src/engine 12,2 %, e2e 12,2 %, src/i18n 3,7 %, .planning 2,8 %, test/bench 0,9 %.
- No change to `.github/workflows/`, `package.json` or `package-lock.json` in the range.
- `.planning/config.json` is modified locally and is **not** committed (orchestrator instruction).

## Requirement trace (step 3)

Method (honesty rule from 01-11):
- Vitest rows: `npx vitest run <files> -t "<ID>" --reporter=json --outputFile=<scratch>/trace-<ID>-unit-*.json`, reading numPassedTests and numFailedTests.
- Playwright rows: `PLAYWRIGHT_JSON_OUTPUT_NAME=… npx playwright test <specs> --grep "<ID>" --reporter=json`, reading stats.expected and stats.unexpected + flaky.
- Where no test title carries the ID, the row falls back to the whole file named in the 02-VALIDATION map. Those rows are marked **file**; filtered rows are marked **filt**.
- A row passes only with exit 0, ≥ 1 passing and 0 failing tests.
- Run against the build from the gate, 2026-11-07 16:38–16:46 UTC.

| Req | Plan(s) | Unit evidence (files · mode · pass/fail) | E2e evidence (specs · mode · pass/fail) | Trace | Requirement status |
|---|---|---|---|---|---|
| RX-01 | 02-03 | — | rx.spec · file · 30/0 | PASS | Complete (manual phone item ± in Task 3) |
| RX-04 | 02-03 | validate.test · filt · 9/0 | rx.spec · file · 30/0 | PASS | Complete |
| RX-05 | 02-03 | validate.test · file · 98/0 | rx.spec · file · 30/0 | PASS | Complete |
| RX-06 | 02-04 | parse.test + validate.test · filt · 46/0 | frame.spec · filt · 10/0 | PASS | Complete |
| RX-07 | 02-03 | — | rx.spec · file · 30/0 | PASS | Complete |
| RX-08 | 02-03 | dictionary.test · file · 147/0 | rx.spec · filt · 2/0 | PASS | Complete |
| FRAME-02 | 02-04, 02-11 | rim + validate + frame + dictionary · filt · 23/0 | frame.spec + expert.spec · file · 78/0 | PASS | Complete |
| FRAME-03 | 02-04 | parse.test · filt · 25/0 | frame.spec · file · 26/0 | PASS | Complete |
| MAT-03 | 02-10 | evaluate + validate · filt · 16/0 | expert.spec · file · 52/0 | PASS | Complete |
| MAT-04 | 02-10 | evaluate + validate · filt · 7/0 | expert.spec · file · 52/0 | PASS | Complete |
| MAT-05 | 02-11 | evaluate + sag + properties + format + validate · filt · 24/0 | expert.spec · file · 52/0 | PASS | Complete |
| MAT-06 | 02-12 | evaluate + validate + parse + dictionary · filt · 68/0 | expert.spec · file · 52/0 | PASS | Complete |
| RES-01 | 02-01 | format + compare · filt · 5/0 | results.spec · file · 22/0 | PASS | Complete |
| RES-02 | 02-06, 02-07 | compare + compute-client · file · 111/0 | compare.spec · filt · 2/0 | PASS | Complete |
| RES-03 | 02-08 | compare.test · filt · 11/0 | compare.spec · file · 30/0 | PASS | Complete |
| RES-04 | 02-01 | compare.test · filt · 9/0 | results.spec · filt · 10/0 | PASS | Complete |
| RES-05 | 02-01, 02-09 | presets.test · file · 18/0 | presets.spec + results.spec · file · 56/0 | PASS | Complete |
| UX-01 | 02-03/04/07/10/11/14 | dictionary.test · filt · 27/0 | a11y + rx + frame · filt · 2/0 | PASS | Complete |
| UX-02 | 02-02, 02-10..13 | — | expert.spec · file · 52/0 | PASS | **Pending**: the heatmap in the Expert view is phase 3 |
| UX-03 | 02-02, 02-14 | — | layout.spec · file · 30/0 | PASS | **Pending**: "lens view stays visible while editing" needs the phase-3 view in `#bar-view-slot`; real-phone keyboard and hyphenation check in Task 3 |
| UX-04 | 02-14 | — | a11y.spec · file · 14/0 | PASS | Complete (manual TalkBack/VoiceOver pass in Task 3) |
| UX-05 | 02-01 | dictionary.test · file · 147/0 (+ grep "Stärke" = 0) | — | PASS | Complete |
| ANA-01 | 02-13 | profile + dictionary · filt · 8/0 | xsec.spec · file · 22/0 | PASS | Complete |
| ANA-02 | 02-02, 02-10 | evaluate.test · file · 124/0 | expert.spec · file · 52/0 | PASS | Complete |
| ENG-09 (regression, phase 1 req.) | 02-06, 02-07, 02-14 | compute-client.test · file · 52/0 | worker.spec · file · 24/0 | PASS (automated) | Complete from phase 1; open proxy findings ENG09-PROXY-1…4, so the phone check in Task 3 decides (lens-critic M3) |

Result: 24/24 rows PASS (plus the ENG-09 regression row). REQUIREMENTS.md is **not** changed in this task; Task 3 step 6 owns it. Its current state already matches the table: 22 Complete, UX-02 and UX-03 Pending.

Limits of this trace, stated plainly:
- "file"-level rows prove that the named file is green, not that each sub-behaviour of the requirement has its own test.
- The per-behaviour coverage claim rests on the 02-VALIDATION map and the plan SUMMARYs.

02-VALIDATION.md is updated: a Task ID column (delivering plans), every row ✅ (UX-02/UX-03/ENG-09 annotated), `status` left `draft` (manual rows and lens-critic open), `nyquist_compliant: true`, `wave_0_complete: true`, Wave 0 boxes ticked (files verified to exist; `settledCompare` and the U+00AD normaliser are in e2e/helpers.js), and all six sign-off boxes ticked. Latency: `npm test` took 46,9 s. The manual-only rows remain for Task 3.

## Open deferred items (from deferred-items.md and the 02 SUMMARYs)

1. **Blur message moves controls, so clicks are lost (02-14, open).** After "Eigene Werte eingeben", a click on an Rx chip blurs the empty R Sph. The 58 px message "Fehler: Bitte einen Wert eingeben." then appears above the chips, and the click misses the chip (6/6 on desktop before the test waited). The same thing happens for every control below a field with a due message: frame chips, `#rx-same`, "Wo finde ich das?". Possible fixes: reserve the message line, or show the empty-field message only after the field was edited.
2. **Engine property tests near their coverage timeouts (02-08, carried forward, open).** Measured under 4 CPU burners:
   - `evaluate.test.js` optimality: 48,2 of 60 s (80 %).
   - `solve.test.js` affected region: 249 of 300 s (83 %).
   - `diagnostics.test.js` extremes grid: 85,5 of 120 s.
   - `diagnostics.test.js` optimality sample: 79,5 of 120 s.

   This is a CI-flake risk; the MAT-02 split-per-case fix would apply. In this unloaded gate the whole coverage run took 189 s and passed.
3. **ENG-09 proxy findings ENG09-PROXY-1…4 (02-14, open).** See above; Task 3 phone check.
4. **UX-02 heatmap and UX-03 lens-view-while-editing.** Phase 3 scope; both requirements stay Pending.
5. Resolved and therefore not open: frame.spec PD echo race (02-07), worker busy-window guard (02-08), compare bench timeout (02-08), MAT-02 timeout (02-09), sticky column over the disclaimer (02-09), Rx chips pushing R Sph below the first screen (02-14), Expert-view layout shift (02-14), compare.spec aborted worker request (02-08).
6. `npm ci` reports 4 moderate vulnerabilities in dev dependencies. The pins are unchanged in phase 2 (T-02-SC accepted), and I did not investigate them here.

## lens-critic result review

**Reviewer:** lens-critic (project agent), result review of origin/main 12219a5 .. eae5443, 2026-11-07. Built HEAD, served with vite preview, driven with Playwright at 360/320 px, engine spot-checked in node. No repo files modified.

**Verdict: NEEDS WORK — not safe to push.**

BLOCKER
- **B1** "am dünnsten"/"Dünnste Stelle" uses `m.etMin.value` (thinnest edge), not the thinnest point (`src/ui/results.js:225,248`; pinned wrong in `e2e/results.spec.js:45,48`). For minus lenses the centre is thinnest: example page reads "am dünnsten 3,0 mm oben. Mitte 1,8 mm". Fix: `thinnest(m)` = min(CT, etMin) with 'centre'; thinnest edge as separate "Dünnster Rand"; re-pin to "am dünnsten 1,8 mm in der Mitte".

MAJOR
- **M1** Cross-section option 0° always labelled "Hauptschnitt" with power sph+cyl when Zyl ≠ 0, even for oblique axes (`src/ui/cross-section.js:58-60`); example L × 170 shows −3,25 instead of ≈ −2,52. Fix: Hauptschnitt only if 0 ∈ {α, α+90}; else meridian power sph + cyl·sin²(θ−α); e2e for axis 170 and 45.
- **M2** Phone summary bar shows frozen A values without a "Vorher" marker while the toggle is on Vorher (`src/ui/results.js:33-36`, `src/ui/summary-bar.js:50`, `src/ui/pipeline.js:643`); a frame edit appears to change nothing. Fix: prefix "Vorher (A):" or auto-switch to Nachher on edit; e2e.
- **M3** Blur message moves controls under the finger (tap on `#rx-same` lost at 360 px touch) and shows "Fehler: Bitte einen Wert eingeben." on untouched fields. Fix: empty-field message only after the field is dirty; reserve the message line.
- **M4** ENG-09 (a) proxy regression 19,5–19,9 ms vs 16,7 ms (ENG09-PROXY-1..4); REQUIREMENTS names both proxy and phone, so the phone alone cannot close it. Suspect (UNVERIFIED) the compare-lane job build in `src/ui/pipeline.js:340-370` (JSON.stringify keys + material table + meridian repaint in the input frame). Fix: profile; defer compare build to a following task; re-measure.

MINOR
- m1 RES-03 "in numbers and in the views": 3D view is phase 3 — treat like UX-02/UX-03; re-map UX-02/UX-03 (and RES-03's 3D part) to Phase 3 in the traceability table.
- m2 Property tests at 80–83 % of coverage timeouts (`evaluate.test.js` optimality, `solve.test.js` affected region) — split per case like MAT-02.
- m3 Material table intro says "das dickere Glas" on a tie; say "beide gleich dick – gezeigt: rechtes Glas".
- m4 Savings partly from per-material minimum thickness; add "Jedes Material mit seiner eigenen Mindestdicke".
- m5 Untouched example values in L/PD/frame stay unmarked after the banner disappears; consider a per-field "Beispielwert" tag.
- m6 No lay note for very thick results (+12 → 13,1 mm; −12/−6 → 18,6 mm).
- m7 Simple view at 360 px ≈ 7850 px tall, results at ≈ 3680 px; transposition line and Expert hint jargon always shown — consider collapsing.
- m8 Add a test that hidden Expert/custom elements stay hidden in Simple view; future traces should name a value-asserting test per requirement.

Verified correct: thickest = max(CT, edge) everywhere; custom = cr39 bitwise; manual BC 0 + convex advice direction; aspheric guard; TABO principal meridians, OC decentration, axis 0 ≡ 180; parsing variants; preset confirm; no overflow at 320/360 px; no console errors.

**Orchestrator decision (2026-11-07):** push withheld. Per the standing best-practice rule, findings go to gap-closure plans (02-16+) followed by a lens-critic re-review before the push checkpoint.

## Rollback path (for Task 2, named before any push)

- Before the push, origin/main = `12219a5`. That is the state Pages served after phase 1, per 01-11; I did not re-check it live in this task.
- Revert option: `git revert --no-edit 12219a5..main` (or one revert of the range on a branch), run the gate, then push. The deploy workflow re-deploys the reverted tree.
- Faster option: in the Actions tab, re-run the last successful `deploy.yml` run for `12219a5`. Pages then serves the phase-1 artifact again, and `main` is left unchanged.
- Push mode: fast-forward only (`git merge-base --is-ancestor origin/main main` first), no force.

## Deviations from Plan

- **Step 4 not run by this executor** (orchestrator instruction): lens-critic is run by the orchestrator, which inserts the review above. The step 6 commit message therefore says "(review pending)".
- **Hygiene check "engine imports no three" printed 1, not 0.** The hit is a test-fixture string in boundary.test.js, not an import (see the note above). I did not change the code.
- **ENG-09 regression row added to the trace.** It is not one of the 24 IDs, but 02-VALIDATION lists it; it was run separately (compute-client.test 52/0, worker.spec 24/0).
- Trace fallback to file level where test titles carry no ID (marked in the table). This is a method choice, not a code change.

## Self-Check

- 02-15-SUMMARY.md: FOUND (this file). 02-VALIDATION.md: modified.
- Gate logs and trace JSON are in the session scratchpad (`trace.tsv`, `trace-<ID>-*.json`, `ci/lint/cov/build/e2e.log`).
- Commit hash: recorded in the orchestrator return message (the commit contains this file).

## Self-Check: PASSED (Task 1 scope; plan not complete)

## lens-critic result RE-review (after gap plans 02-16 … 02-22), 2026-11-07

Range 12219a5 .. d60caf5; independent build, e2e 389 passed / 1 skipped; drove the page at 320/360 px with touch.

**Verdict: NEEDS WORK (0 BLOCKER, 1 MAJOR). Safe to push to the live site now: yes** — numbers and lay UI correct, ENG-09 honestly Pending; condition: 02-15 must not close ENG-09 or M4 on the quiet proxy.

- Verified fixed on the built page: B1 (example "am dünnsten 1,8 mm in der Mitte" + "Rand ab 3,0 mm"; plus, plano, mixed cyl correct), M1 (xsec labels for axes 170/45/180/90, Zyl 0, +2 −4 × 30 match F(θ)), M2 ("Vorher (A):" on one line at 320/360 px), M3 (touch taps on #rx-same and frame chip land; no Fehler on untouched fields; message announced once), m-g (accepted).
- **MAJOR-1 (= M4 still open):** quiet method measures whole-value edits only. Key-by-key at 4×: input max 13,2–22,2 ms, 3/14 runs ≥ 16,7 ms. Window starts at the input's own rAF callback (earlier callbacks in the same frame not counted); ruleA omits result and compare-paint frames; max-of-3 flips with host load (one default run 19,0 ms). Fix: quiet-keys mode, window from the rAF timestamp, include result/compare frames, p95 over ≥ 5 runs with load recorded.
- MINOR-1: card and bar empty and refill on every incomplete keystroke ("-", "-4,"); keep last valid values greyed out instead (also the main extra typing cost).
- MINOR-2: bar test fixture narrow; style.css:112 comment wrong (margin 12,4 px); 200 % text size unverified.
- MINOR-3: check app-commit on the phone matches the pushed HEAD (stale-app risk).
- MINOR-4: STATE.md "Total plans completed: 15" stale.

Orchestrator: REQUIREMENTS.md ENG-09 note narrowed to "whole-value edits only" so it does not overstate the proxy result.
