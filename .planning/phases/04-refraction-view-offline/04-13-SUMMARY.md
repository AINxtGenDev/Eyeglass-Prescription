---
phase: 04-refraction-view-offline
plan: 13
subsystem: phase gate (version, full gate, trace, re-measure, review input)
tags: [gate, trace, bench, eng-09, lens-critic, checkpoint]
requires: [04-01 … 04-12, 04-14, 04-15]
provides: [dev-1.8, 04-VALIDATION statuses, requirement trace, lens-critic input]
affects: [04-13 Task 2 (push approval), 04-13 Task 3 (live + phone)]
key-files:
  modified: [version.js, .planning/phases/04-refraction-view-offline/04-VALIDATION.md]
  created: [.planning/phases/04-refraction-view-offline/04-13-SUMMARY.md]
decisions:
  - "nyquist_compliant and wave_0_complete stay false: 04-05-T3 / 04-13-T1 are red on the BENCH_GATE Grenzfall budgets and 04-13-T3 is pending"
  - "npm ci skipped locally (node_modules installed from the unchanged package-lock.json; CI runs npm ci)"
  - "ENG-09 (a)–(d) with the worker controlling the page and Durchblick shown were measured with a scratch copy of the perf spec (not committed), because the committed perf spec neither waits for the controller nor runs ENG-09 in Durchblick"
metrics:
  completed: 2026-11-14
  tasks: "1 of 3 (stopped at the Task 2 checkpoint)"
---

# Phase 4 Plan 13: Phase gate, Task 1 Summary

dev-1.8 at d07e16d passes lint, 2138 unit tests, both builds, 684 e2e tests, the live subset, test:dist and the local @live pwa tests with 0 failures. The one red item is BENCH_GATE: the Grenzfall Rx and the rim case miss the UI-SPEC Node budgets. This was already known from 04-05 and is listed below as an open finding. The plan stops at the Task 2 push checkpoint.

## Checkpoint: awaiting user

Task 2 (approve the phase-4 push, the first service-worker deploy) has not been asked or answered. Nothing has been pushed. Task 3 has not run.

**lens-critic verdict (2026-11-14, phase-result review):** PASS WITH FINDINGS — 0 BLOCKER, 2 MAJOR, 9 MINOR; none ship-blocking. Under the gate rule the phase is done only once the MAJORs are fixed or accepted by the user.
- MAJOR 1: BENCH_GATE timing budgets red on the Grenzfall Rx (57 / 17 / 13 ms vs 30 / 15 / 8) and the 639×800 rim case; mitigated by phone start tier mittel and the tested step-down guard. Re-base with a written reason or accept; the Task 3 phone trace must confirm ≤ 200 ms or the "vereinfacht" note.
- MAJOR 2: the chart texture is 4096² regardless of tier (`src/ui/view/refraction.js:55`, `:136-137`), costing about 64 MB of canvas and 89 MB of GPU memory, never measured on a phone. Suggested: 2048 on phone tiers, release the source canvas after upload, and add first-entry time and context loss to Task 3.
- m1: the rim note shows when the rim band is 5–6 px of #221e1c beside #1a1a1a squares (1164 px).
- m2: the fullscreen Dickenkarte note points to a hidden table.
- m3: `view.caption.ref` "So sehen Sie mit dieser Brille …" overclaims, because the picture is always sharp.
- m4: 1 px overflow at 320 px @150 % (result cards, WCAG 1.4.10).
- m5: ReadPixels GPU-stall warning at 412 px (likely the bar thumbnail `scene.js:159`, unverified).
- m6: kill build shows `update.done.other` and `tech.offline.failed` wording.
- m7: the ENG-09 worker-controlled measurement used an uncommitted scratch spec.
- m8: the first CI run may flake under load.
- m9: the remaining open list (pool 10→12, A/B under 360 px wording, 2,99 px edge, MINOR 11).
Confirmed in code: the warp grid uses the engine's `traceFromEye` and its surfaces (no second optics copy); the tested build is the deployed build; the SW scope, prompt mode, handover and kill switch are safe to deploy; the rollback statement is honest.
**gsd-verifier (9d6f9ab):** human_needed, no gaps. SC1 and SC3 are verified in code; SC2 (phone) and SC4 (this verdict or user acceptance) are pending.

## Guards (step 1)

- SUMMARY files 04-01 … 04-12, 04-14 and 04-15 exist. `git log --oneline | grep -c "(04-NN)"` gave: 01 7, 02 3, 03 7, 04 3, 05 6, 06 4, 07 5, 08 4, 09 4, 10 5, 11 5, 12 4, 14 8, 15 5.
- `grep -cF -- "- SC1/D-02 reported to user 2026-11-13:" session.md` printed `1`. `grep -nF` found line 57:
  > `57:- SC1/D-02 reported to user 2026-11-13: accepted explicitly by the user the same day; M3 on-screen pixel tests are the hard gate in 04-08; 04-13 asks for confirmation only.`
- Neither commit of this plan touches session.md, STATE.md, ROADMAP.md or README.md.
- `grep -c "export const SW_SELF_DESTROY = false" sw-kill-switch.js` = 1 (line 10).

## Gate at HEAD d07e16d (step 3)

| Command | Result |
|---|---|
| `npm ci` | **skipped**. node_modules is installed from the unchanged package-lock.json, and CI runs `npm ci` |
| `npm run lint` | exit 0 |
| `npm run test:coverage` | exit 0: 59 files, 2138 passed. All files: statements 99,25 %, branches 97,73 %, functions 100 %, lines 99,63 %. engine 98,84 / 97,43 / 100 / 99,37; engine/mesh 99,8 / 98,48 / 100 / 100. No diagnostics timeout this time (load was low) |
| `GITHUB_SHA=$(git rev-parse HEAD) npm run build` | exit 0: precache 16 entries (963,42 KiB). `dist/index.html` has `content="d07e16d"` and `dev-1.8` |
| `npm run build:e2e` | exit 0 |
| `npm run test:e2e` | exit 0: **684 passed, 55 skipped, 0 failed** (26,6 min, 4 workers, load up to 26). Skips by design: project-specific tests (mobile-only / desktop-only), plus `kill switch active @live`, which runs only with the flag on |
| `npm run test:e2e:live` | exit 0: 323 passed, 1 skipped (rx MJ-2, mobile). `ref-live.spec.js` passed on desktop and mobile |
| `npm run test:dist` | exit 0: 21 passed, 1 skipped (destroyer shape, flag off). `precache size: 1006196 bytes (1.006 MB, limit 2000000)` |
| `npm run test:pwa:live` (local switch server) | exit 0: offline item 17, scope and manifest, CSP with the worker passed; kill-active skipped (flag off) |
| `npm run test:perf` | exit 0: 3 passed (9,6 min) |
| `BENCH_GATE=1 npx vitest run test/bench/warp-tiers.test.js` | **exit 1: 3 failed, 4 passed** (the normal-case budget assertions; tables below) |

No single e2e test failed, so no reruns were needed.

### BENCH_GATE=1 at HEAD (M2), second run with `--silent=false` (load 2,4 → 1,9; i7-8809G, 8 logical CPUs)

The first run (load 4,2) gave the same verdicts, and its normal-case numbers were within 0,4 ms of these.

Normal cases, one two-panel job of the 412 px layout. The budget applies to the median of the two Rx medians.

| Tier | NORMAL_PAIR rays / median / p95 | GRENZFALL_PAIR rays / median / p95 | Combined median | Budget | Verdict |
|---|---|---|---|---|---|
| fein | 1617+1617 / 4,00 / 4,31 ms | 5777+5777 / 110,00 / 118,10 ms | 57,00 ms | 30 ms | **FAIL** |
| mittel | 925+925 / 2,26 / 2,50 ms | 1693+1693 / 31,86 / 32,76 ms | 17,06 ms | 15 ms | **FAIL** |
| grob | 600+600 / 1,52 / 1,71 ms | 1208+1208 / 24,06 / 31,45 ms | 12,79 ms | 8 ms | **FAIL** |

Rim case (item-12 frame rechteckig 40 / 28 / 14, PD 40, CR-39, OD). All 4 tests PASS: rimInField, rays monotonic, medians monotonic, grob ≤ 0,6 × fein.

| Case | Tier | Rays | Median | p95 | Above that tier's normal-case budget |
|---|---|---|---|---|---|
| −4,00, 320 one-panel 288 × 216 | fein | 6549 | 42,24 ms | 47,90 ms | **yes** (30) |
| | mittel | 1900 | 10,16 | 10,99 | no (15) |
| | grob | 1394 | 8,31 | 8,59 | **yes** (8) |
| | grob/fein | | 0,197 | | gate ≤ 0,6 PASS |
| +4,00, 320 one-panel | fein | 6421 | 42,28 | 43,14 | **yes** |
| | mittel | 1900 | 10,74 | 11,09 | no |
| | grob | 1426 | 9,08 | 9,35 | **yes** |
| | grob/fein | | 0,215 | | PASS |
| −4,00, largest 639 × 800 | fein | 23540 | 112,56 | 114,76 | **yes** |
| | mittel | 9845 | 41,74 | 44,30 | **yes** |
| | grob | 6609 | 29,04 | 30,19 | **yes** |
| | grob/fein | | 0,258 | | PASS |
| +4,00, largest 639 × 800 | fein | 26356 | 139,14 | 145,34 | **yes** |
| | mittel | 10421 | 49,32 | 55,19 | **yes** |
| | grob | 7025 | 34,10 | 38,25 | **yes** |
| | grob/fein | | 0,245 | | PASS |

## Requirement trace (step 4)

All counts come from the runs above at d07e16d.

| Req | Tests (files / titles) | Command | Pass / fail |
|---|---|---|---|
| REF-01 | trace, magnification, evaluate, warp, outline-geom, text, ref-layout, warp-protocol (unit) | `npx vitest run --project unit <8 files>` | 345 / 0 |
| | view-ref.spec (items 1–12, 14–15, 25, M3 (a) oracle + on-screen gate, item 26), ref-live.spec (M4 live smoke), view-memory (item 16), view-compare, view-fullscreen | `npm run test:e2e` | 53 / 0, 2 / 0, 2 / 0, 13 / 0, 14 / 0 |
| | ref-live on the production dist | `npm run test:e2e:live` | 2 / 0 |
| REF-02 | guard, warp-client, tiers (unit) | `npx vitest run --project unit <3 files>` | 40 / 0 |
| | view-ref "REF-02 degradation (04-10)" incl. the rim case from mittel (mobile), view-controls (thumbnail guard) | `npm run test:e2e` | in view-ref 53 / 0; view-controls 40 / 0 |
| | warp-tiers bench: ray-count / monotonic / rim | `BENCH_GATE=1 npx vitest run test/bench/warp-tiers.test.js` | 4 / 3 (the 3 failures are the timing budgets; see the open findings) |
| | Durchblick 4× proxy | `npm run test:perf` | 1 / 0 (informational) |
| OFF-01 | sw-core, handover, boundary, test/ci (pins, env-gates, live-subset, flaky-reporter, workflow-structure) | `npx vitest run --project unit …` | 142 / 0 |
| | pwa-build, parity, hooks (dist) | `npm run test:dist` | 21 / 0 (1 skipped by flag) |
| | pwa.spec: items 17, 18, N12, CSP, 19–24, 20b, carry-overs, kill rehearsal, axe banner states | `npm run test:e2e` (pwa project) | 20 / 0 (1 skipped by flag) |
| | @live offline, scope, CSP | `npm run test:pwa:live` | 3 / 0 |

Every requirement has at least 1 pass and 0 failures in its functional tests. REF-02 also has the red timing gate. It is listed as a finding and is not counted as a functional failure.

Locked decisions and the plan/test that implements each:

| Group | Plan → test |
|---|---|
| D-01, D-03, D-08, D-12 (a–f) | 04-01 / 04-03 → trace.test, magnification.test, warp.test, outline-geom.test |
| D-02 (reinterpreted, user-accepted 2026-11-13), D-07 | 04-08 / 04-09 → view-ref M3 (a) oracle + on-screen gate, items 12, 25 |
| D-04, D-05 | 04-01 → magnification.test (Le Grand 3,04 mm), text.test |
| D-06, D-09, D-10, D-11a | 04-08 / 04-09 / 04-11 → view-ref items 7, 11, 26; view-compare |
| D-13, D-14 | 04-08 / 04-11 → view-ref item 8/9, view-memory item 16 |
| D-15, D-16, D-17 | 04-05 / 04-10 → guard.test, tiers.test, view-ref REF-02, perf Durchblick |
| D-18 … D-25 | 04-04 / 04-06 / 04-07 / 04-14 → pins.test, pwa-build.test, sw-core.test, handover.test, pwa.spec items 17–24 |
| D-26 | 04-13 → version.js dev-1.8, smoke.spec version assertion |
| D-27, D-29, D-30 | 04-11 / 04-12 → view-memory, a11y.spec (54 / 0) |
| F-01 | 04-15 → flaky-reporter.test, retries |
| F-02 | 04-12 → view-fullscreen (14 / 0) |
| F-03 | 04-15 → a11y "everything open" 90 s |
| F-04 | 04-02 / 04-08 → hooks.test, env-gates.test, parity.test |
| F-05 | 04-13 Task 3 (phone; pending) |
| F-06 | 04-10 → view-controls thumbnail guard |

## ENG-09 / D-22 / D-17 re-measure (step 5)

### Committed perf project (`npm run test:perf`, 1280 × 800 unless stated, worker unthrottled, SwiftShader)

| Block | 04-13 | Phase 3 (03-17) / 04-10 | Target |
|---|---|---|---|
| Durchblick input → picture, default Rx | median 92,15, p95 103,4 ms; fein → fein; worker compute 8,5 / 13,1 ms | 04-10: 88,8 / 106,0; fein | ≤ 200 ms |
| Durchblick, rim (rund 40/28/14, PD 40) | median 103,15, p95 261,8 ms; **fein → mittel**; compute 35,65 / 153,9 ms | 04-10: 122,2 / 258,0; fein → mittel | ≤ 200 ms |
| 3D-Neuaufbau 1280 | 58,05 / 90,2 ms | 59,6 / 94,6 | ≤ 200 |
| 3D-Neuaufbau 412 (bar) | median 59,35, p95/max 1392,7 ms | 1373,6 / 1387,1 | ≤ 200 |
| Orbit 1280 / 412 | 916,7 / 816,6 ms median | 841,7 / 850 | ≤ 16,7 |
| ENG-09 (c), 3D + comparison | median 30,8, longest 38,4 ms; estimate 50,5 ms | 30,6 / 34,7; 46,75 | ≤ 100 |

The ENG-09 blocks of the same session (Glas view, page not confirmed as controlled):

| Rate | Case A frame max | Case B frame max | Compare start max | Rule A | (c) estimate | (d) |
|---|---|---|---|---|---|---|
| 1× | 2,5 | **884,6** | 0,5 | **fail** | 26,9 | pass |
| 2× | 5,6 | 5,3 | 0,4 | pass | 31,7 | pass |
| 4× | 8,1 | 7,7 | 1,0 | pass | 50,8 | pass |
| 6× | 12,1 | 12,6 | 1,5 | pass | 71,8 | pass |

At 1×, one of the 10 case B frames was 884,6 ms (the median was 1,9 ms), which looks like a SwiftShader 3D frame. It did not recur in the two re-runs below (1× case B 5,7 ms in Glas, 2,4 ms in Durchblick). Phase 3 had 2,2 ms. Verdicts (a) and (b) fail on the extreme run, as in phase 3 (SwiftShader re-mesh frames).

### D-22: worker active, scratch copy of the perf spec (`eng09-sw.spec.js` in the scratchpad, rates 1 and 4, dist-e2e on 4174)

Before measuring, each run waited for `navigator.serviceWorker.controller`. The SW state read `scope …/Eyeglass-Prescription/, activated, controlled: true`, and `#tech-offline` read "Offline verfügbar …". The view mode was then switched as noted.

| View | Rate | (a) Rule A: A / B / compare max | (a) worst incl. extreme | (b) worst reaction | (c) measured result med / max; estimate | (d) busy marking |
|---|---|---|---|---|---|---|
| Durchblick (fein, 49 / 74 counted samples, never degraded, still controlled at the end) | 1× | 2,5 / 2,4 / 0,2 → pass | 37,3 ms | 48,9 ms pass | 24,65 / 36 ms; 37,3 pass | pass (4 busy, longest 69,3 ms) |
| | 4× | 8,3 / 8,5 / 0,8 → pass | 119,2 ms | 126,6 ms pass | 26,25 / 35,1 ms; 47,4 pass | pass (6, longest 129,8 ms) |
| Glas | 1× | 2,0 / 5,7 / 0,2 → pass | 1463,1 ms | 1468,9 fail | 23,5 / 25,3; 26,5 pass | pass |
| | 4× | 8,3 / 8,8 / 0,9 → pass | 1563,9 ms | 1576,2 fail | 26,65 / 40,9; 53,1 pass | pass |

In Durchblick the extreme-run worst frame drops from about 1,5 s to 37–119 ms, because the 3D re-mesh is deferred while the Durchblick stage is on screen (04-09 M4). (b) passes there. The failing Glas (a)/(b) values have the same cause as in phase 3: SwiftShader re-mesh frames. Only the phone can judge them (Task 3).

## Visual matrix (step 6)

**The chrome-devtools MCP is not available in this executor's tool set.** I used Playwright Chromium instead (headless, SwiftShader, `serviceWorkers: 'block'` for the view states). It ran on `npm run preview` (production dist, 4173, served `d07e16d`). The degraded state ran on dist-e2e (4174) with `?refdegraded`. The banner ran on the switch server (4175, dist → dist-b). Sizes: 412×915 at DPR 2,6 (mobile), 320×640 at DPR 2 (mobile), 1164×593, 1280×800. Scripts: `/tmp/claude-1000/-home-nuc8-05-development-45-brille/b0bfe4db-4f99-4ec0-9b82-85bf847c85cc/scratchpad/04-13-matrix.mjs` and `/tmp/claude-1000/-home-nuc8-05-development-45-brille/b0bfe4db-4f99-4ec0-9b82-85bf847c85cc/scratchpad/04-13-fs-banner.mjs`. Shots: `/tmp/claude-1000/-home-nuc8-05-development-45-brille/b0bfe4db-4f99-4ec0-9b82-85bf847c85cc/scratchpad/04-13-shots/` (45 PNG). DOM facts: `matrix.json`, `matrix-deg.json`, `fsb.json` in the same scratchpad.

DOM facts for every state at every size: `overflowX` 0; no pill overlaps the badge or the fullscreen button; no "kein Durchblick" text; 0 duplicate IDs in fullscreen. Size lines, confirmed against the UI-SPEC: −4,00 "etwa 6 % kleiner", −0,75 "1,1 %" + weak note, −1,00 "1,4 %" with no weak note, 0,00/−1,00×180 "senkrecht (90°) etwa 1,4 % kleiner / waagrecht (180°) etwa 0,1 % größer" + cyl and shape notes, −6,00 1,67 "8 %", −10,00 "13 %", +4,00 "8 % größer", −2,00/−2,00×30 the exact E4 strings + mirror note.

I looked at these shots and describe what they show:

| Shot | What it shows |
|---|---|
| 412 default (−4,00) Mit | Two panels, "Linkes Glas" left and "Rechtes Glas" right, at the bottom. The squares near the panel edges are visibly smaller and bowed (barrel-like) compared with the centre. The edge ticks sit off the square edges at the left/right borders. The badge (top left) and the fullscreen button (top right) do not touch the pills |
| 412 default Ohne | A regular grid with the letter band "P E D E"; the ticks line up with the square edges |
| 320 rim −4,00 OD Mit | One panel. A wide dark rim band on the screen-right (temporal) side, about 70 px of 290; the chart up to it; no grey fill, no pill |
| 320 rim OS ("Linkes Glas") | The same band mirrored to the screen-left side |
| 1164 rim −4,00 in-page | Two panels 198 px wide. Pixel probe: a 5–6 px band of #221e1c at the outer edges, (34,30,28) against the black squares (26,26,26). **It is hard to tell from a black square by eye**, but the rimNote "Der dunkle Streifen im Bild ist der Rand Ihrer Fassung." is shown (finding below) |
| 412 −2,00/−2,00×30 | Visible oblique shear, mirrored between the two panels. The squares are tilted |
| 412 −10,00 | Strong minification toward the corners; squares bowed; letter band shifted; no fill zone |
| 1280 +4,00 | Squares larger at the edges than in −4,00 (pincushion-like); ticks offset |
| 412 OS blocked | Left panel is the grey fill with the pill "Linkes Glas – nicht berechnet" and no ticks. The right panel renders |
| 1280 A/B (CR-39 vs 1,67, −2,00) | Panels "Vorher (A)" and "Nachher (B)", the same at a glance (both "2,9 % kleiner"); the abNote "Material und Fassung ändern den Durchblick meist nur wenig …" is shown |
| 320 degraded (`?refdegraded`) | Badge "Durchblick · vereinfacht"; grey note box with an info icon and the black left border after the scope sentence, wraps without clipping; the picker is stacked |
| 412 fullscreen Durchblick | The canvas fills the top 549 px, and the info panel below holds the tip, Mit/Ohne, the size block and the scope (rects do not intersect). The ticks are drawn at panel edges, and the exit button is top right |
| 320 fullscreen Dickenkarte | The glasses with the heat map, R/L labels and a "2,0" callout; the legend 1,5–5,0 mm and "Für die Zahlen am Glas ist die Ansicht zu klein – alle Werte stehen in der Tabelle." (the table is not reachable in fullscreen: known 04-12 item) |
| 412 update banner | "Neue Version verfügbar" region, "Aktualisieren" (filled) and "Später"; banner bottom 847 px, bar top 855 px (above the bar, no overlap); focus stays on `#expert`; the banner covers part of the form behind it |
| 412 banner while typing | Focus in Sph (y 501, h 44). The banner is hidden, the field is visible, and the bar is shown |

Console (in place of `list_console_messages`): no errors and no page errors. At every size there is the expected `Service Worker registration blocked by Playwright` warning (a test setting). **At 412×915 only, Chromium's WebGL warning `GL Driver Message … GPU stall due to ReadPixels` appears 4× (then "will no longer repeat").** It also appears in the 412 degraded run and in the 412 fullscreen Durchblick run. This is very probably the bar-thumbnail readback (03-15). UI-SPEC chrome-devtools item 3 asks for "no WebGL warnings", so it is listed as a finding. The banner run (412, worker allowed) had an empty console, with `scope …/Eyeglass-Prescription/` and the offline line "Offline verfügbar …".

UI-SPEC chrome-devtools item 4 (4× Durchblick + ENG-09 (c) with the worker) is covered by the perf tables above. Item 5 (Pixel trace) is Task 3.

### Leak re-check (04-11 open item)

`view-memory.spec.js -g Durchblick`, desktop, 3 separate runs: each run went `allocPage` 10 → 12 with geometries 30, textures 7, programs 14 and 1 context unchanged. It is bounded at 12 across runs. Growth within one longer session (the same sequence repeated in one page) was **not** tested.

## lens-critic input (step 8)

### Orchestrator decisions 1–6 and the D-02 reinterpretation

1. h = 15 mm = HSA 12 mm [ASSUMED] + entrance pupil 3,0 mm (Le Grand 3,04 mm, reproduced as 3,0376 mm by magnification.test from the six table values).
2. Live subset LIVE_SPECS against the production dist; the e2e build differs only by the MODE-gated hooks (04-02).
3. No textbook claim; `tech.ref.formulaSource` says what the fetched sources support (product form with the vertex distance; the entrance-pupil reference from the derivation and US 8,805,612 B2). The Bennett & Rabbetts page stays an **open human item**.
4. P0 fixes the field and tiers (30°, fein 6/1, mittel 8/2, grob 10/3).
5. Ports and servers: dist-e2e 4174 by default, dist 4173 with E2E_LIVE=1, switch server 4175; `reuseExistingServer: false`.
6. **D-02 reinterpretation: accepted explicitly by the user on 2026-11-13** (session.md line 57, quoted above). ROADMAP SC1 is judged by the Mit/Ohne blink, the reference ticks and the text. The M3 on-screen results at HEAD: view-ref.spec 53 passed / 0 failed. That includes "M3 (a) oracle" (LL_o ≥ 20, LR_o ≤ 0,25·LL_o; flipped/mirrored mappings fail), the on-screen gate (LL_s ≥ 0,6·LL_o, LR_s ≤ LR_o + 0,2·LL_o for OD/OS), (b) inward/outward off the centre row, and (c) the y-asymmetric rim. **For confirmation only at Task 2.**

Assumed HSA: 12 mm (lay text "angenommener Wert"; the scope sentence shows "15,0 mm hinter dem Glas (angenommener Wert)").

New strings: `view.ref.rimNote`, `view.ref.rimPastNote`, `view.ref.cylSameNote`, `tech.ref.formulaSource` (04-01 / 04-08; text.test and i18n key-set tests green).

### N-items

| Item | Closed by |
|---|---|
| N3 rimNote + rimInField | 04-01 / 04-03 / 04-09: warp.test rimInField, view-ref item 12; seen in the 320 and 1164 rim shots |
| N4 tick under-stroke 6 px at DPR 1 / 2,6 | 04-09 |
| N5 bottom ticks unobstructed | 04-09: view-ref item 25 (b) samples the bottom ticks |
| N6 weak note ≤ 1,3 % | 04-01 / 04-03: text.test, E10 at the 400 px layout; −0,75 shows the note and −1,00 (1,4 %) does not (matrix) |
| N7 cylSameNote | 04-01: text.test |
| N8 controllerchange-only path | 04-07: sw-core.test (stubbed plugin); pwa item 20 / 20b |
| N9 tan-unit sample points | 04-03 / 04-09: warp.test E9, view-ref item 12 |
| N10 grid error ≤ 0,5 px edge, ≤ 2 px class boundary | 04-03: warp.test "N10", P0 (≤ 0,45 px for the fixed tiers) |
| N11 ticks hidden on rim | 04-09: view-ref item 12 / 25 |
| N12 first visit offline | 04-06: pwa "first visit, offline before the 3D view (N12)" |

### Round-1 findings

| Finding | Closed by (plan / test) |
|---|---|
| M1 kill switch gate + rehearsal | 04-04 (one flag, `swKillEffective`, destroyer shape in pwa-build.test), 04-14 (rehearsal both ways in pwa.spec; flag-flipped full gate) |
| M2 rim case in bench, tier-dependent leafPx, ray-count gate | 04-03 (tiers 1/2/3 px leaves, ray-count gate), 04-05 (bench rim case), 04-10 (step-down cuts rays, view-ref "rim case from mittel"); BENCH_GATE above |
| M3 mirrored-cylinder / swapped-eye pixel test | 04-08: view-ref M3 (a) oracle + on-screen gate, (b), (c) |
| M4 tested = deployed | 04-02: parity.test, env-gates.test, hooks.test; 04-08: ref-live.spec in LIVE_SPECS (passes on dist here); verify-live runs `test:pwa:live` |
| M5 citation | 04-01: source line, `tech.ref.formulaSource` |
| MINOR 1 drawn interpolant | 04-03: warp.test N10 triangle interpolant |
| MINOR 2 E10 at 400 px + stage sizes | 04-03: measure-stages.mjs, P0 §0 |
| MINOR 3 tirBack synthetic, real class-3 | 04-01: trace.test |
| MINOR 4 Le Grand 3,04 mm | 04-01: magnification.test |
| MINOR 5 hadController / first-visit tab | 04-07: sw-core.test; pwa item 20b |
| MINOR 6 rollback text | 04-13 Task 2 context (W3C citation, "no rollback for returning visitors") |
| MINOR 7 SC1 asked early | Orchestrator, 2026-11-13; session.md line 57 |
| MINOR 8 strings | 04-01: text.test (no "Prozentpunkt"; rimPastNote rule) |
| MINOR 9 pwa serial | 04-06: `fullyParallel: false`, one file |
| MINOR 10 nyquist flag | 04-13: left false (see VALIDATION) |
| MINOR 11 older query switches | deferred-items.md (out of scope) |

### P0, budget and ray count

The P0 stage-size table is in 04-P0-RESULTS.md §0. Measured panels: 412 in page 189 × 285 (246,82 px/tan); 320 in page 288 × 216 (249,42); 1164 / 1024 in page 198 × 248,75 (215,42); 1280 in page 270 × 338,75 (293,37); the largest is 639 × 800 (1280 fullscreen, 692,82). **Minimum panel long side for a 3,0 px −1,00 edge shift: 250 px.** The 400 px column (248,75 px) gives 2,9876 px with no weak note: known P0 finding, the "2,99 px" item.

E6 and the ray count (M2): the ray gates pass on every case. The **timing budgets fail** (tables above).

### Tested vs deployed (M4)

parity.test and env-gates.test pass at HEAD (test:dist 21/0, unit test/ci). The hook-free Durchblick smoke `ref-live.spec.js` passes against the production dist (desktop and mobile), and verify-live runs `test:pwa:live` against the live URL in CI. The live run is Task 3.

### Kill switch (M1)

- `SW_SELF_DESTROY = false`.
- The rehearsal (pwa.spec "kill switch rehearsal: kill and re-enable (M1)") passed at HEAD.
- 04-14 outcome: after the kill, registrations 0 and `caches.keys()` [], the sibling probe cache was deleted too (blast radius demonstrated), and offline worked again after the re-enable.
- The flag-flipped full gate was run in 04-14 and 04-12, not again at HEAD.
- Sibling Cache Storage (04-14, read-only GETs): simplify_llm and testing use no service worker and no Cache Storage. interior-design is on its own custom domain (a different origin). workflow does not exist. So a kill deploy deletes only our caches on ainxtgendev.github.io, and this should be re-checked before a real kill.
- Using the kill switch needs its own approval.

### D-21 handover (04-14)

Form values, Experten-Ansicht and comparison B are handed over, written at reload time in every reloading tab. An estimated lens height B is left out (A re-derives it). A restored comparison focuses `#cmp-diff`. Tests: pwa items 19, 20, 20b, 24a/b, "handover keeps a comparison and the B estimate", "half-typed invalid input".

### Open findings (must not be dropped)

1. **BENCH_GATE budgets fail (M2/E6).** Grenzfall combined medians fein 57,0 / mittel 17,1 / grob 12,8 ms against 30 / 15 / 8. Rim values above the normal-case budget: 320 one-panel fein (42,2 / 42,3 ms) and grob (8,3 / 9,1 ms); 639 × 800 all tiers (fein 112,6 / 139,1, mittel 41,7 / 49,3, grob 29,0 / 34,1 ms). The ray and monotonic gates pass, and grob/fein is 0,20–0,26.
2. **WebGL warning "GPU stall due to ReadPixels" at 412×915** (likely the bar-thumbnail readback), against UI-SPEC chrome-devtools item 3.
3. **1× ENG-09 rule A outlier** in the committed perf run (one case B frame 884,6 ms; not reproduced in 2 re-runs).
4. **rimNote in the 1164 in-page tablet layout**: the rim is a 5–6 px band at the panel edge whose colour #221e1c is close to the chart black #1a1a1a. The note says "der dunkle Streifen", but the stripe is hard to see there.
5. The 89 MB 4096² chart texture (GPU memory; not measured on a phone).
6. The M3 (c) sample line is 3,5 squares temporal (no valid frame on the 0,5 line).
7. The past-rim note (`rimPastNote`) rule.
8. 2,99 px edge shift at the 400 px column with no weak note (P0).
9. Diagnostics coverage timeouts under load (not seen this run).
10. View-memory page pool 10 → 12 (bounded across 3 runs; once 11 in 04-12; a single long session not tested).
11. A/B below 360 px uses the one-panel wording; PD is shared in A/B (B runs at A's PD).
12. A kill deploy probably shows `update.done.other` once (unverified).
13. The load-dependent guard in the e2e build (Durchblick step-down on slow runners; no failure this run).
14. 04-12: 1 px overflow at 320 px with a 150 % root font (result cards); the fullscreen Dickenkarte note points to a hidden table; m4 low corner only via forced layout; pool 11 vs 10 once.
15. MINOR 11: seven older query switches in production (deferred).
16. Open human items: the Bennett & Rabbetts page; the real phone (F-05 / SC2, Task 3).

## Deviations from Plan

- **[Plan instruction] `npm ci` skipped** (orchestrator rule). CI runs `npm ci` before the gate.
- **[Rule 3 - Blocking] chrome-devtools MCP not available to this executor.** The visual matrix ran in Playwright Chromium on the same builds, as in 04-08 / 04-10. A real-GPU MCP pass on the live site remains for Task 3 step 3.
- **[Rule 2 - Missing measurement] ENG-09 (a)–(d) with the worker controlling the page and Durchblick shown.** The committed perf spec does neither, so a scratch copy (not committed) waited for the controller and switched the mode. Results above.
- The P0 script was not re-run (only its CI subset, inside test:coverage). The engine trace has been unchanged since cebd643.

## Commits

- d07e16d chore(04-13): version label dev-1.8
- (this docs commit) docs(04-13): gate, trace and lens-critic input (Task 1)

Before this docs commit: `git log --oneline origin/main..main | wc -l` = 110 (origin/main 47bb4e2). `git diff --stat origin/main..main | tail -1` = `134 files changed, 28845 insertions(+), 1652 deletions(-)`.

## Self-Check: PASSED

- version.js contains dev-1.8 (grep 1); commit d07e16d exists; 04-VALIDATION.md updated; SUMMARY written. Nothing pushed.
