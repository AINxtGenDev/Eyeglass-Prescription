---
phase: 02-lay-first-german-input-results-comparison
plan: 21
subsystem: phase gate (post-gap re-gate)
tags: [phase-gate, requirement-trace, value-asserting-tests, lens-critic-m8, crosswalk, gap-closure, ENG-09]
requires: [02-16, 02-17, 02-18, 02-19, 02-20]
provides:
  - "Full gate green at the post-gap HEAD ac2aa94 (npm ci, lint, test:coverage, build with GITHUB_SHA, test:e2e), unpiped logs with exit codes"
  - "Fresh 24-row phase-2 trace plus the ENG-09 regression row, each with exit 0, >= 1 pass, 0 fail, and one named value-asserting test per row"
  - "Finding crosswalk: 02-15 lens-critic B1, M1-M4, m1-m8 and gap-plan review MJ-1, MJ-2, m-a..m-g -> plan -> commit -> test -> status"
  - "02-VALIDATION.md: gap-plan tests per row, value-asserting test column, status draft"
affects: [.planning/phases/02-lay-first-german-input-results-comparison/02-VALIDATION.md]
tech-stack:
  added: []
  patterns:
    - "Trace rows name one value-asserting test (file:line) that checks a displayed value or state, not only a green file"
key-files:
  created:
    - .planning/phases/02-lay-first-german-input-results-comparison/02-21-SUMMARY.md
  modified:
    - .planning/phases/02-lay-first-german-input-results-comparison/02-VALIDATION.md
decisions:
  - "Requirement status copied from REQUIREMENTS.md as it stands (RES-03, UX-02, UX-03 Pending 'Phase 2 + 3'; ENG-09 Pending per 02-20); REQUIREMENTS.md not edited"
  - "ENG-09 / lens-critic M4 stays an open MAJOR; the harness question goes to the user with the three 02-20 options, not decided here"
metrics:
  duration: "about 15 min (2026-11-07 19:20:58-19:36 UTC; gate 5 min 40 s, trace 7 min)"
  completed: 2026-11-07
  tasks: 2
  files: 2
---

# Phase 2 Plan 21: Post-gap gate, value-level trace and finding crosswalk — Summary

The post-gap HEAD `ac2aa94` passes the same gate as 02-15 Task 1. All 24 phase-2 requirements and the ENG-09 regression row trace green, and each row names one test that asserts a displayed value or state. Of the 13 lens-critic result-review findings, 8 are closed by 02-16..02-19. m5–m7 are accepted for later (the user confirmed this). **M4 (ENG-09) is still an open MAJOR.** Nothing was pushed: origin/main = `12219a5204efb70e885b9cf7d7829ff8c77f71b2`.

**Watch first:**
- **ENG-09 is Pending and M4 is an open MAJOR.** In 02-20 the 4× proxy failed (a) in 3 of 3 runs: case A max 21,7 / 19,1 / 20,5 ms, case B max 23,3 / 24,9 / 21,8 ms, limit 16,7 ms. Trace attribution: a Playwright DevTools-session task (`blink.mojom.DevToolsSession`) takes 10–16 ms of every measured 4× frame. The app's own work in the window is ≤ 9,7–11,8 ms. The user has to choose between the three options in the hand-off below.
- "Green" says nothing about the phase-3 parts of RES-03, UX-02 and UX-03. These stay Pending.

## Task 1: Full gate at the post-gap HEAD

Guards:
- `git rev-parse HEAD origin/main` → `ac2aa94062810476864cf369162d3a53694d6bcf` / `12219a5204efb70e885b9cf7d7829ff8c77f71b2`. origin/main has not changed, so nothing was pushed.
- `git diff --stat 12219a5 -- package-lock.json package.json .github` is empty (T-02-SC).

The gate ran 2026-11-07 19:20:58–19:26:38 UTC: `npm ci; npm run lint; npm run test:coverage; GITHUB_SHA=$(git rev-parse HEAD) npm run build; npm run test:e2e`. Each step wrote unpiped to `<scratchpad>/gate/{ci,lint,cov,build,e2e}.log`, with `EXIT=$?` appended.

| Step | Exit | Real output (tail) |
|---|---|---|
| `npm ci` | 0 | `added 157 packages, and audited 158 packages in 1s` · `4 moderate severity vulnerabilities` (pre-existing; lockfile unchanged since 12219a5) |
| `npm run lint` | 0 | `> eslint .` (no findings) |
| `npm run test:coverage` | 0 | `Test Files 34 passed (34)` · `Tests 1595 passed (1595)` · `Duration 191.19s` · Statements 98.34 % (831/845), Branches 96.52 % (389/403), Functions 100 % (82/82), Lines 99.15 % (706/712); engine 98.01 / 96.07 / 100 / 98.98 |
| `GITHUB_SHA=… npm run build` | 0 | `vite v8.3.6` · `✓ 48 modules transformed.` · `dist/index.html 43.15 kB` · `dist/assets/index-crgXIAGo.js 130.38 kB │ gzip: 45.05 kB` · `dist/assets/engine.worker-D73Rly2A.js 19.31 kB` · `✓ built in 164ms` |
| `npm run test:e2e` | 0 | `Running 390 tests using 4 workers` · `1 skipped` · `389 passed (2.3m)` (no failed, no flaky) |

- The one skipped test is `[mobile] e2e/rx.spec.js:316` "MJ-2: an input frame inside the press does not paint the queued message twice". It is skipped by design on touch (02-18-SUMMARY: with touch the blur comes after the finger lifts). It runs and passes on desktop.
- Coverage per engine file (stmts/branch/funcs/lines):

  | File | Stmts | Branch | Funcs | Lines |
  |---|---|---|---|---|
  | evaluate.js | 98.34 | 98.37 | 100 | 97.89 |
  | metrics.js | 98.33 | 95.55 | 100 | 100 |
  | power.js | 96.42 | 88.88 | 100 | 100 |
  | profile.js | 97.87 | 93.61 | 100 | 100 |
  | sag.js | 92.59 | 87.5 | 100 | 100 |
  | solve.js | 100 | 97.95 | 100 | 100 |
  | trace.js | 92.75 | 81.81 | 100 | 93.84 |

  These are identical to 02-15.
- Against 02-15 at 68c4e63: unit tests went from 1564 to 1595, and e2e from 336 to 389 passed plus 1 skipped.

### Hygiene checks (02-15 commands, unchanged)

| Check | Command | Result |
|---|---|---|
| references/ not tracked | `git ls-files references \| wc -l` | 0 |
| nothing from references/ or .planning in dist | `find dist -path '*references*' -o -path '*.planning*' \| wc -l` | 0 |
| no "Stärke" | `grep -c "Stärke" src/i18n/de-AT.js` | 0 |
| no innerHTML/outerHTML/insertAdjacentHTML | `grep -rn "innerHTML\|outerHTML\|insertAdjacentHTML" src/ui \| wc -l` | 0 |
| engine imports no three | `grep -rlE "from 'three" src/engine \| wc -l` | **1, see note**; the hit is `src/engine/boundary.test.js`; excluding test files: 0; `grep -rnE "^\s*import .*from 'three" src/engine \| wc -l` = 0 |
| no storage APIs | `grep -rn "localStorage\|sessionStorage\|indexedDB\|document.cookie" src --include=*.js \| grep -v test \| wc -l` | 0 |
| no inline styles | `grep -rn 'style="' index.html \| wc -l` | 0 |
| CSP | `grep -c "style-src 'self'" vite.config.js` | 1 |
| exact-CSP e2e | `e2e/worker.spec.js:41` "engine runs in a module worker under the sub-path (ENG-09)" | passed on desktop and mobile (gate log, and the ENG-09 trace row) |
| build embeds the commit | `grep -c 'content="ac2aa94"' dist/index.html` | 1 |

Note on the three check: this is the same as 02-15. The one hit is two source *strings* in `boundary.test.js`. The boundary test feeds them to ESLint to prove that the `no-restricted-imports` rule rejects `three` in the engine. No engine module imports three.

## Task 2: Requirement trace with value-asserting tests

Method: the same as 02-15, using the same script with a new output file (`<scratchpad>/trace21.sh` → `trace21.tsv`, `t21-<ID>-{unit,e2e}-{filtered,file}.json`). It ran against the Task 1 build, 2026-11-07 19:26:52–19:33:50 UTC, with script exit 0.
- Vitest: `-t "<ID>" --reporter=json`. Playwright: `--grep "<ID>" --reporter=json`.
- Where no title carries the ID, the row falls back to the whole file and is marked **file**. Filtered rows are marked **filt**.
- A row passes only with exit 0, ≥ 1 passing and 0 failing tests.
- New this time: the ENG-09 row also runs `e2e/compare.spec.js` (the 02-20 tests carry "ENG-09" in their titles).

**Value-asserting test** = one named test that asserts a displayed value or state for the requirement (lens-critic m8). Each one was checked as passed in the Task 1 gate log, on desktop and mobile (`grep "✓.*e2e/<file>:<line>:"` gives one desktop and one mobile line; the a11y.spec.js:75 loop gives 4 + 4). The unit ones were checked in the trace JSON (`status: passed`).

| Req | Plan(s) | Unit (files · mode · pass/fail) | E2e (specs · mode · pass/fail) | Trace | Value-asserting test | Requirement status (REQUIREMENTS.md now) |
|---|---|---|---|---|---|---|
| RX-01 | 02-03 | — | rx.spec · file · 51/0 | PASS | `e2e/rx.spec.js:18` 'row headers: R before L, in the paper wording' | Complete |
| RX-04 | 02-03, 02-18 | validate.test · filt · 9/0 | rx.spec · file · 51/0 | PASS | `e2e/rx.spec.js:55` 'Außerhalb des Modells: never clamped, card blocked, jump to the field' | Complete |
| RX-05 | 02-03, 02-18 | validate.test · file · 98/0 | rx.spec · filt · 21/0 | PASS | `e2e/rx.spec.js:225` 'untouched: "Eigene Werte eingeben", Tab out of the empty R Sph shows no Fehler' + `:238` 'edited: type "1", clear it, Tab: the empty-field Fehler appears on blur' (02-18) | Complete |
| RX-06 | 02-04 | parse + validate · filt · 46/0 | frame.spec · filt · 10/0 | PASS | `e2e/frame.spec.js:117` '"64" is the binocular PD: 32 mm per eye' | Complete |
| RX-07 | 02-03 | — | rx.spec · file · 51/0 | PASS | `e2e/rx.spec.js:122` '"Linkes Auge gleich wie rechtes" mirrors Sph, Zyl, Achse read-only; PD stays' | Complete |
| RX-08 | 02-03 | dictionary.test · file · 148/0 | rx.spec · filt · 2/0 | PASS | `e2e/rx.spec.js:159` 'other values on the paper (RX-08) are explained in a closed <details>' | Complete |
| FRAME-02 | 02-04, 02-11 | rim + validate + frame + dictionary · filt · 23/0 | frame.spec + expert.spec · file · 82/0 | PASS | `e2e/frame.spec.js:102` 'A outside 40–62 mm: Außerhalb des Modells, both eyes blocked, never clamped' + `e2e/expert.spec.js:375` 'Randtiefe: default 3,0 mm, the example edge is 1,6 mm deeper, 5 fits, no recompute' | Complete |
| FRAME-03 | 02-04, 02-18 | parse.test · filt · 25/0 | frame.spec · filt · 2/0 | PASS | `e2e/frame.spec.js:16` 'the temple stamp sets A and DBL; B is estimated from the shape and disclosed' | Complete |
| MAT-03 | 02-10 | evaluate + validate · filt · 16/0 | expert.spec · file · 54/0 | PASS | `e2e/expert.spec.js:172` 'manual base curve: 6 is used, 0 computes, 12 is Außerhalb des Modells' | Complete |
| MAT-04 | 02-10 | evaluate + validate · filt · 7/0 | expert.spec · file · 54/0 | PASS | `e2e/expert.spec.js:196` 'minimum thicknesses: pre-filled per material, typed value kept, Standardwerte setzen, switch off' | Complete |
| MAT-05 | 02-11 | evaluate + sag + properties + format + validate · filt · 24/0 | expert.spec · file · 54/0 | PASS | `e2e/expert.spec.js:318` 'aspheric front: k field and note only for asphärisch, thinner plus centre, same base curve' | Complete |
| MAT-06 | 02-12 | evaluate + validate + parse + dictionary · filt · 68/0 | expert.spec · file · 54/0 | PASS | `e2e/expert.spec.js:453` 'Eigenes Material: card only in the Experten-Ansicht; CR-39 constants give the 1,50 numbers, labelled' | Complete |
| RES-01 | 02-01, 02-16 | format + compare · filt · 13/0 | results.spec · file · 26/0 | PASS | `e2e/results.spec.js:27` 'example at load: banner, both cards with the pinned values, no L/R sentence' (lines 51/54: '… am dünnsten 1,8 mm in der Mitte …', 02-16) + `src/state/compare.test.js:53` 'RES-01 minus lens: the centre' | Complete |
| RES-02 | 02-06, 02-07, 02-19, 02-20 | compare + compute-client · filt · 7/0 | compare.spec · filt · 12/0 | PASS | `e2e/compare.spec.js:28` 'example: six rows, 1,74 saves 1,6 mm and 4 g; switching moves "Ihre Auswahl"' | Complete |
| RES-03 | 02-08, 02-17 | compare.test · filt · 11/0 | compare.spec · filt · 4/0 | PASS | `e2e/compare.spec.js:295` 'RES-03 summary bar: Vorher (A) prefix through toggle, frame edit and end' (02-17) | **Pending** ('Phase 2 + 3': views part is phase 3) |
| RES-04 | 02-01 | compare.test · filt · 9/0 | results.spec · filt · 10/0 | PASS | `e2e/results.spec.js:75` 'R −4,00 / L −5,25: the left glass is thicker (5,8 / 7,2 mm)' | Complete |
| RES-05 | 02-01, 02-09 | presets.test · file · 18/0 | presets.spec + results.spec · file · 60/0 | PASS | `e2e/presets.spec.js:51` "'Stark kurzsichtig' removes the banner, keeps PD and shows the pinned values" | Complete |
| UX-01 | 02-03/04/07/10/11/14 | dictionary.test · filt · 27/0 | a11y + rx + frame · filt · 2/0 | PASS | `e2e/a11y.spec.js:217` 'UX-01: every term has a tip that opens by click, Enter and Space and closes by Esc' | Complete |
| UX-02 | 02-02, 02-10..13, 02-19 | — | expert.spec · filt · 2/0 | PASS | `e2e/expert.spec.js:637` 'UX-02 Simple view hides every Expert-only element (m8)' (02-19) | **Pending** ('Phase 2 + 3': heatmap is phase 3) |
| UX-03 | 02-02, 02-14, 02-17, 02-18 | — | layout.spec · file · 30/0 | PASS | `e2e/layout.spec.js:32` 'never scrolls horizontally, also with a long value and without hyphenation' | **Pending** ('Phase 2 + 3': lens view while editing is phase 3; real-phone check in 02-15 Task 3) |
| UX-04 | 02-14 | — | a11y.spec · file · 14/0 | PASS | `e2e/a11y.spec.js:75` 'axe WCAG 2.2 AA zero violations and no overflow at 320 px: ${name}' | Complete (manual TalkBack/VoiceOver in 02-15 Task 3) |
| UX-05 | 02-01 | dictionary.test · file · 148/0 | — | PASS | `src/i18n/dictionary.test.js:52` 'never uses "Stärke" (thickness is Mittendicke/Randdicke)' | Complete |
| ANA-01 | 02-13, 02-17 | profile + dictionary · filt · 8/0 | xsec.spec · filt · 10/0 | PASS | `e2e/xsec.spec.js:162` 'ANA-01 axis 170 (example L −2,50 / −0,75 × 170): 0° is kein Hauptschnitt, −2,52 dpt' (02-17) | Complete |
| ANA-02 | 02-02, 02-10 | evaluate.test · file · 130/0 | expert.spec · file · 54/0 | PASS | `e2e/expert.spec.js:46` 'Zwischenwerte for the example (A 52, DBL 18, PD 32 / 31,5)' | Complete |
| ENG-09 (regression, phase 1 req.) | 02-06, 02-07, 02-14, 02-20 | compute-client.test · filt · 33/0 | worker.spec + compare.spec · filt · 8/0 | PASS (automated) | `e2e/compare.spec.js:359` 'ENG-09 RES-02: five quick R Sph values, the comparison converges to the last one (latest-wins)' (02-20) | **Pending** (02-20 proxy FAIL; lens-critic M4 open MAJOR) |

Result: 24 of 24 rows PASS, plus the ENG-09 regression row. No row has "none" in the value-asserting column. REQUIREMENTS.md is unchanged: of the 24 phase-2 IDs, 21 are Complete and 3 are Pending (RES-03, UX-02, UX-03). ENG-09 (a phase-1 ID) is also Pending.

Notes on how to read the counts:
- Some rows changed mode since 02-15 because the gap plans added IDs to test titles. These rows are now narrower filtered runs instead of whole files: RX-05 e2e (21), FRAME-03 e2e (2), RES-02 unit (7), RES-03 e2e (4), UX-02 e2e (2), ANA-01 e2e (10) and ENG-09 unit (33). The other tests in those files passed in the gate.
- A "file" row still proves only that the file is green. The value-asserting column names the test that pins a value or state. It is not proof that every sub-behaviour has its own test.
- The ENG-09 automated row covers ordering and latest-wins. The (a) frame-time criterion is not part of the default suite (`npm run test:perf` only), and in 02-20 it failed.

02-VALIDATION.md now has a "Value-asserting test (02-21 trace)" column on all 25 map rows. Task 1 added the gap-plan tests with file:line. `status: draft` is kept.

## Findings crosswalk

### 02-15 lens-critic result review (13 findings)

| ID | Finding (short) | Plan | Commit(s) | Test(s) | Status |
|---|---|---|---|---|---|
| B1 | "am dünnsten" used the thinnest edge, not min(CT, edge) | 02-16 | 8d10871, d6a946a, 3d19083 | `src/state/compare.test.js:52–91` 'RES-01 thinnest point (lens-critic B1) …'; `e2e/results.spec.js:27` (headline 'am dünnsten 1,8 mm in der Mitte'), `:156` 'plus lens keeps the thinnest edge as the thinnest point (02-16, lens-critic B1)', `:166` 'plano lens: thickest = thinnest point, both read "überall gleich" (02-16)' | closed |
| M1 | 0° always "Hauptschnitt" with sph+cyl for oblique axes | 02-17 | 7958640, 705e047 | `e2e/xsec.spec.js:162` axis 170 (−2,52 dpt), `:175` axis 45 (−2,00 dpt), `:186` axis 180, `:195` axis 90, `:205` Zyl 0 | closed |
| M2 | Phone bar shows frozen A without a "Vorher" marker | 02-17 | d2cc153, f6dd551 | `e2e/compare.spec.js:295` 'RES-03 summary bar: Vorher (A) prefix through toggle, frame edit and end', `:337` 'RES-03 summary bar: the prefixed bar does not wrap and stays under the scroll padding' | closed |
| M3 | Blur message moves controls under the finger; Fehler on untouched fields | 02-18 | bc6431d, a6ef91e, 1df18a1, a7c0df4 | `e2e/rx.spec.js:225`, `:238`, `:250`, `:263`, `:277` (dirty rule, eye rule); `:304` '"abc" in R Sph, then at once "Gleich für beide Augen": the box is checked, the Fehler follows'; `:336`, `:343`; `e2e/frame.spec.js:205` 'FRAME-03 M3: …the drawing opens' | closed |
| M4 | ENG-09 (a) proxy regression 19,5–19,9 ms vs 16,7 ms | 02-20 | c014962, 9431ce0, 96e5338, b80a4f5, 4c76f6d | `e2e/compare.spec.js:359`, `:375`, `:396` (ordering, pass); `e2e/perf-throttled.spec.js` verdict (a) (PERF=1): 4× case A max 21,7 / 19,1 / 20,5 ms, case B 23,3 / 24,9 / 21,8 ms, **FAIL** | **open MAJOR**: ENG-09 Pending; needs explicit user decision at 02-15 (see hand-off) |
| m1 | RES-03 "in the views" is phase 3; re-map RES-03/UX-02/UX-03 | 02-19 | aaeac57 | doc change; checked by grep `\| RES-03 \| Phase 2 + 3 \| Pending \|` (also UX-02, UX-03) = 1 each in REQUIREMENTS.md | closed (user approved 2026-11-07) |
| m2 | Property tests at 80–83 % of their coverage timeouts | 02-19 | d19accc | `src/engine/evaluate.test.js:335` 'optimality for all lenses: … sph ${sph}' (7 tests), `src/engine/solve.test.js:445` 'property (affected region, numRuns 200, seed 12): … samples …' (10 chunks); slowest piece 46,7 % of 60 s under 4 burners | closed (small margin, see 02-19) |
| m3 | Material intro says "das dickere Glas" on a tie | 02-19 | ab7a5f0, 26f4b36 | `src/state/compare.test.js:260` 'RES-02 shownEye …' (`:263` '4,6 / 4,6 → OD, tie'); `e2e/compare.spec.js:53` 'RES-02 intro: example tie names the shown eye, and each material its own minimum (m3, m4)', `:60` | closed |
| m4 | Savings partly from per-material minimum thickness, not said | 02-19 | ab7a5f0, 26f4b36 | `e2e/compare.spec.js:53`, `:60` | closed |
| m5 | No per-field "Beispielwert" tag | — (deferred-items.md) | 649e658, aaeac57 | — | accepted for later (user confirmed 2026-11-07, "i approve") |
| m6 | No lay note for very thick results | — (deferred-items.md) | 649e658, aaeac57 | — | accepted for later (user confirmed 2026-11-07) |
| m7 | Simple view long at 360 px; jargon always shown | — (deferred-items.md) | 649e658, aaeac57 | — | accepted for later (user confirmed 2026-11-07) |
| m8 | Test that hidden Expert elements stay hidden; name value-asserting tests in traces | 02-19, 02-21 | ab7a5f0, 26f4b36; this plan | `e2e/expert.spec.js:637` 'UX-02 Simple view hides every Expert-only element (m8)'; value-asserting column in the trace above | closed |

### lens-critic gap-plan review (2026-11-07, amendments to 02-16..02-20)

| ID | Finding (short) | Plan | Commit(s) | Test(s) | Status |
|---|---|---|---|---|---|
| MJ-1 | Deferred compare start must be posted after the input frame's end stamp | 02-20 | 96e5338 | `e2e/compare.spec.js:375` 'ENG-09 RES-02: #compare[data-pending] carries "queued" from the input frame on, and the start runs after the frame (MJ-1)'; `data-min-gap ≥ 0` in verdict (a) (b80a4f5) | closed (the ordering; the frame-time verdict is M4) |
| MJ-2 | A queued (afterGesture) paint must count as pending | 02-18 | 1df18a1, a7c0df4 | `e2e/rx.spec.js:316` 'MJ-2: an input frame inside the press does not paint the queued message twice' (desktop; skipped on mobile by design) | closed |
| m-a | Keep only the edge reads of `m.etMin.value` (uniform-edge headline, Dünnster Rand) | 02-16 | 3d19083 | `e2e/results.spec.js:120` 'uniform edge: rund 50/50/18, PD 34, −3,00 both eyes' ('Rand ringsum 3,7 mm', 'Rand ab 3,7 mm') | closed |
| m-b | Uniform edge: 'Dickster Rand' location 'am ganzen Rand' | 02-16 | 3d19083 | `e2e/expert.spec.js:88` 'uniform edge keeps "am ganzen Rand" with the Expert suffix'; `e2e/results.spec.js:166` | closed |
| m-c | No old rows next to the new selection while the start is queued | 02-20 | 9431ce0, 96e5338 | `e2e/compare.spec.js:396` 'ENG-09 RES-02: while the compare start is queued, no old rows are painted next to the new selection (m-c)' | closed |
| m-d | Gesture tracker ends on blur/visibilitychange/keydown, 1,5 s cap | 02-18 | 1df18a1, a7c0df4 | `e2e/rx.spec.js:363` 'm-d: a press that is never released does not keep the message queued (1,5 s cap)', `:375` 'm-d: the window losing focus during a press ends it …' | closed |
| m-e | Drop clearDirty; eye rule for edited Zyl/Achse | 02-18 | bc6431d, a6ef91e | `e2e/rx.spec.js:277` 'eye rule: an edited Zyl of that eye makes the empty Sph show its Fehler'; `:263` | closed |
| m-f | On FAIL: ENG-09 Pending and M4 open MAJOR carried to 02-21 | 02-20, 02-21 | 4c76f6d, a9e99c6; this plan | REQUIREMENTS.md `- [ ] **ENG-09**` and traceability Pending; this crosswalk and the hand-off | closed (carried; M4 itself open) |
| m-g | 320 px bar with the 'Vorher (A):' prefix must not wrap | 02-17 | f6dd551 | `e2e/compare.spec.js:337` (height with prefix = without, ±1 px; label one line; bar < 72 px). The literal "≤ 56 px" was replaced: the bar is 59,6 px with and without the prefix (02-17 deviation 2) | closed with an adjusted assertion; lens-critic should confirm |

## Hand-off

**Next: lens-critic re-review of 12219a5..HEAD (orchestrator). Then 02-15 Task 2 (push approval) and Task 3 (push, live and phone checks).** 02-15 Task 3 step 6 must:
- keep RES-03, UX-02 and UX-03 Pending (their phase-3 parts, 02-19);
- leave ENG-09 as 02-20 left it: Pending.

The m5–m7 deferrals need the user's acceptance at the checkpoint. That acceptance is already on record (2026-11-07, "i approve", deferred-items.md), together with RES-03/UX-02/UX-03 → Pending "Phase 2 + 3". **That approval does not cover the push.** The push stays a separate, explicit decision at the 02-15 checkpoint.

**Open MAJOR for explicit user decision at 02-15: lens-critic M4 / ENG-09 (a).**
- 02-20 result: FAIL. ENG-09 is set to Pending, and M4 remains an open MAJOR.
- Trace attribution: a Playwright DevTools-session task (`blink.mojom.DevToolsSession`) takes 10–16 ms of each measured 4× frame. The app's work is ≤ 9,7–11,8 ms.

The options from 02-20-SUMMARY are open. This plan does not choose one:
1. Change the proxy harness so it does not issue a CDP command while an input frame's timeout is pending (for example, wait in the page before polling). This changes the measurement method, so it needs user approval.
2. Accept the proxy gap, based on the trace evidence.
3. Optimise app-side paint. Paint is 5–7 ms and the largest app bucket.

Other open items (none blocks the trace):
- The phase-3 parts of RES-03, UX-02 and UX-03.
- The manual-only rows in 02-VALIDATION: real-phone keyboard and bar, hyphenation, ENG-09 on a phone, and TalkBack/VoiceOver.
- `npm ci` reports 4 moderate dev-dependency vulnerabilities (pre-existing, not investigated).
- The m2 split margin: 46,7 % under 4 burners.
- The style.css comment "72 px = 56 px bar + 16 px" is inaccurate. The real margin is 12,4 px (02-17 note).

**Rollback path:** 02-15-SUMMARY "Rollback path". origin/main is `12219a5` before the push. Either `git revert` the range on a branch, run the gate and push fast-forward, or re-run the last successful `deploy.yml` for `12219a5`. Never force-push.

## Deviations from Plan

- **ENG-09 trace row also runs `e2e/compare.spec.js`** with `--grep "ENG-09"`. 02-20 put its ENG-09 tests there, and the 02-15 row only covered worker.spec.js. This is a method extension; no code changed.
- **Task 1 commit includes no gate logs.** As in 02-15, the logs are in the session scratchpad (`gate/*.log`, `trace21.tsv`, `t21-*.json`), not in the repo.
- No code changes. No `fix(02-21)` commit was needed: every gate step passed on the first run.

## Known Stubs

None (documentation-only plan).

## Self-Check: PASSED

- FOUND: 02-21-SUMMARY.md (this file) and 02-VALIDATION.md (modified; 26 lines with "Value-asserting": the header plus 25 rows).
- FOUND commit d0b30db (Task 1). The Task 2 commit contains this file.
- Gate logs `gate/{ci,lint,cov,build,e2e}.log` each end in `EXIT=0`. `trace21.tsv` has 25 rows, all exit=0 with fail=0.
- origin/main = 12219a5204efb70e885b9cf7d7829ff8c77f71b2 (checked with `git rev-parse origin/main`).
