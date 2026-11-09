---
phase: 03-3d-lenses-frame
plan: 17
subsystem: phase gate
tags: [phase-gate, requirement-trace, lens-critic, VIZ-01, VIZ-02, VIZ-03, VIZ-04, VIZ-05, VIZ-06, RES-03, UX-02, UX-03]
requires: [03-16, 03-REVIEW-FIX]
provides:
  - "Full gate green at HEAD 7f44aef (npm ci, lint, test:coverage, build with GITHUB_SHA, test:e2e) plus the informational test:perf proxy"
  - "9-row phase-3 requirement trace, each row >= 1 passing and 0 failing tests"
  - "03-VALIDATION.md: statuses, nyquist_compliant: true, wave_0_complete: true, sign-off boxes"
  - "lens-critic input for the phase-3 result review"
affects: [.planning/phases/03-3d-lenses-frame/03-VALIDATION.md]
tech-stack:
  added: []
  patterns: []
key-files:
  created:
    - .planning/phases/03-3d-lenses-frame/03-17-SUMMARY.md
  modified:
    - .planning/phases/03-3d-lenses-frame/03-VALIDATION.md
decisions:
  - "VIZ-06 stays Pending although its trace row passes: the real-phone part (no visible lag on a mid-range phone, ENG-09 (c) with 3D + comparison) is Task 3 on the Pixel 7 Pro"
  - "The e2e trace counts come from the JSON report of the one full gate run (filtered by requirement ID in the test title), not from separate re-runs; the unit trace is separate `vitest run -t <ID>` runs with the JSON reporter"
  - "No second e2e run: the first full run had 0 failed and 0 flaky, so the orchestrator's re-run rule did not trigger and no test was changed"
metrics:
  duration: "Task 1: about 40 min (2026-11-08 23:22 – 2026-11-09 00:03 UTC), without the MCP matrix and lens-critic"
  completed: "partial (Task 1 of 3)"
status: partial
---

# Phase 3 Plan 17: Phase gate, requirement trace and lens-critic input — Summary

**Status: partial (2026-11-08).** Task 1 is done, except the chrome-devtools MCP matrix (the orchestrator runs it; placeholder below) and the lens-critic verdict (the orchestrator runs it and inserts it). Task 2 (push approval) and Task 3 (push, live check, Pixel 7 Pro, REQUIREMENTS.md) have not started. **Nothing has been pushed.** STATE.md, ROADMAP.md and REQUIREMENTS.md are not changed.

**Watch first:**
- **The bar thumbnail is the biggest open performance risk.** On the 4× proxy, input → 3D paint at 412×915 with the bar shown is **1 373,6 ms median** (SwiftShader readback stall per thumbnail frame, 03-15), against 59,6 ms at 1280 without the bar. Only the Pixel measurement in Task 3 can say what this costs on a real GPU.
- **`window.__eyeglassView` ships in production** (B-IN-06, open Info). Any script on the shared `ainxtgendev.github.io` origin can trigger a synchronous render and GPU readback through it. It returns no Rx values. lens-critic should decide whether this blocks the push.
- **New observation (not in 03-REVIEW):** in the no-WebGL state the four preset buttons stay visible (disabled) and `#view-canvas` keeps `role="img"` without `aria-hidden`. This is the same pattern as A-IN-05, which the fixer only closed for the load-failure path. Not fixed here (Task 1 changes no code).

## Guards (step 1)

- 03-01-SUMMARY.md … 03-16-SUMMARY.md exist. `git log --oneline` has commits tagged `(03-NN)` for every plan: 01:5, 02:6, 03:5, 04:5, 05:5, 06:3, 07:5, 08:4, 09:5, 10:3, 11:3, 12:4, 13:5, 14:6, 15:6, 16:3.
- The code-review fixes are in: a5c21ae … f4b55f1 and the fix report 7f44aef (03-REVIEW-FIX.md: 12 of 12 in-scope findings fixed).
- HEAD: `7f44aef2059d1edc621f9f001cb2813d0c23fc49` (`7f44aef docs(03-review): fix report`). Working tree clean at the start.
- origin/main: `bac1c38dbd6fcc5f72578235cf0a3ba5f7041722`.

## Full gate (step 2), HEAD 7f44aef, 2026-11-08 23:22–23:51 UTC

The steps ran one after the other, each into its own log with its exit code. Logs: `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/gate17/`.

| Step | Exit | Real output (tail) |
|---|---|---|
| `npm ci` | 0 | `added 158 packages, and audited 159 packages in 2s` · `4 moderate severity vulnerabilities` (same count as in 02-15; the only dependency change in the range is `three@0.187.0`) |
| `npm run lint` | 0 | `> eslint .` (no findings) |
| `npm run test:coverage` | 0 | `Test Files 46 passed (46)` · `Tests 1787 passed (1787)` · `Duration 202.56s` · All files 98,91 % statements / 96,87 % branches / 100 % functions / 99,48 % lines; `engine` 98,07 / 96,19 / 100 / 99,01; `engine/mesh` 99,8 / 98,48 / 100 / 100 (only `heat.js` line 143 uncovered) |
| `GITHUB_SHA=$(git rev-parse HEAD) npm run build` | 0 | `vite v8.3.6` · `✓ 75 modules transformed` · `dist/index.html 47.50 kB` · `index-8_zv6g0r.js 143.02 kB │ gzip 49.18 kB` · `view-DiAbhTIw.js 638.43 kB │ gzip 168.15 kB` · `mesh.worker 14.61 kB` · `engine.worker 19.31 kB` · `index.css 25.21 kB` · `✓ built in 359ms`; the known "> 500 kB chunk" warning for the lazy view chunk |
| `curl -s -o /dev/null -w "%{http_code}" http://localhost:4173/Eyeglass-Prescription/` | (curl 7) | `000`: no stale server on 4173 before the e2e run |
| `npm run test:e2e` (run as `npx playwright test --reporter=list,json`, the same command plus a JSON report) | 0 | `557 passed (16.3m)` · `33 skipped` · 0 failed · 0 flaky (JSON stats: expected 557, unexpected 0, flaky 0, skipped 33) |
| `npm run test:perf` | 0 | `2 passed (7.5m)` (informational proxy, numbers below) |

- The build embeds the commit: `grep -c 'content="7f44aef"' dist/index.html` = 1.
- The 33 skips are deliberate project skips, for example "desktop project (pointer path) only", "one run is enough (desktop project)", "mobile project only".
- **Load-sensitive tests:** a11y.spec.js:291, view-memory.spec.js:58 and layout.spec.js:302 all passed in this full run. So there is only one e2e run and no `test(03-17)` commit.
- `npm test` (quick-run latency for the sampling contract): 52,27 s wall, see "Quick-run latency" below.

### D-27 leak test numbers (view-memory.spec.js, desktop, from this full run)

- After the warm-up: geometries 21, textures 6, programs 11, allocPage 10, allocWorker 0.
- After 56 changes: the same values, identical to the fixer's run.

### Hygiene checks

| Check | Command | Result |
|---|---|---|
| references/ not tracked | `git ls-files references \| wc -l` | 0 |
| nothing from references/ or .planning in dist | `find dist -path '*references*' -o -path '*.planning*'` | (empty) |
| no "Stärke" | `grep -c "Stärke" src/i18n/de-AT.js` | 0 |
| no HTML sinks | `grep -rn "innerHTML\|outerHTML\|insertAdjacentHTML" src/ui \| wc -l` | 0 |
| engine imports no three | `grep -rnE "^\s*import .*from 'three" src/engine \| wc -l` | 0 |
| three only in src/ui/view/** | non-test files outside src/ui/view that import 'three' | 0 |
| no storage APIs | `grep -rn "localStorage\|sessionStorage\|indexedDB\|document.cookie" src --include=*.js \| grep -v test \| wc -l` | 0 |
| no inline styles | `grep -rn 'style="' index.html \| wc -l` | 0 |
| CSP | `grep -c "style-src 'self'" vite.config.js` | 1 |

### 4× proxy (`npm run test:perf`, PERF=1, 23:43:45–23:51:16 UTC; JSON copy `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/gate17/perf17.json`)

Every 3D number below is **software-rendered (SwiftShader) with the worker unthrottled**. CDP CPU throttling reaches neither the workers (01-15) nor SwiftShader, so these are **not phone numbers**.

| Block | Layout | 03-17 result | 03-15 result | Target |
|---|---|---|---|---|
| 3D-Neuaufbau, input → 3D paint (10 Sph edits) | 1280×800 (no bar) | median 59,6 ms, p95/max 94,6 ms | 55,9 / 90,7 ms | ≤ 200 ms (INP good) |
| 3D-Neuaufbau | 412×915 (bar shown, thumbnail) | median 1 373,6 ms, p95/max 1 387,1 ms | 1 379 / 1 412 ms | ≤ 200 ms |
| Orbit, rAF frame (3 s drag) | 1280×800 | median 841,7 ms, p95 883,3 ms (3 moves landed) | 866,6 / 900 ms | ≤ 16,7 ms |
| Orbit | 412×915 | median 850 ms, p95 883,3 ms (2 moves) | 858,4 / 900 ms | ≤ 16,7 ms |
| ENG-09 (c) with 3D + comparison | 1280×800 | input → result painted median 30,6 ms, longest 34,7 ms; estimate 46,75 ms | 29,1 / 40,6 ms; 52,7 ms | ≤ 100 ms (RAIL) |

ENG-09 blocks from the same session. Rule A (case A/B input frame and compare start < 16,7 ms) passes at every rate:

| Rate | Case A frame max | Case B frame max | Compare start max | (c) estimate | Extreme run: frame max / reaction max | Final edge |
|---|---|---|---|---|---|---|
| 1× | 2,7 ms | 2,2 ms | 0,2 ms | 25,8 ms | 867,3 / 875,0 ms | 7,3 mm |
| 2× | 3,9 | 4,1 | 0,5 | 32,4 | 969,5 / 976,7 | 7,3 |
| 4× | 7,8 | 9,2 | 0,7 | 47,1 | 979,7 / 996,0 | 7,3 |
| 6× | 15,8 | 11,9 | 1,5 | 68,4 | 1 486,5 / 1 504,9 | 7,3 |

- As in 03-15, the extreme-run frames of about 0,9–1,5 s come from the 3D re-mesh frames in SwiftShader. The proxy verdicts (a)/(b) are therefore 'fail' here. Only the phone can judge them (Task 3).
- 6× case A at 15,8 ms is close to the 16,7 ms rule A limit (03-15: 11,4 ms). This is a single-session proxy number and is informational only.

## Commit manifest (for Task 2)

- `git log --oneline origin/main..main | wc -l` = **100** commits (81d83ef `docs(03): research phase domain` … 7f44aef), plus the docs commit from this task (101 in total).
- `git diff --stat origin/main..main`: **111 files changed, 21975 insertions(+), 130 deletions(-)**.
- `package.json` / `package-lock.json`: the only change is the runtime dependency `"three": "0.187.0"` (exact pin).
- No change to `.github/workflows/`.

## Requirement trace (step 3)

Method:
- **Unit:** `npx vitest run <files> -t "<ID>" --reporter=json --outputFile=…/u-<ID>-filt.json`, reading `numPassedTests` / `numFailedTests`. A whole-file run was also done for each row. Where no test title carries the ID, the row uses the file run and is marked **file**.
- **E2e:** from the JSON report of the full gate run (`e2e1.json`). The counts are tests whose describe chain + title contains the ID (**filt**), per project (desktop and mobile both count). The skips are deliberate project skips.
- A row passes only with ≥ 1 passing and 0 failing tests. Run 2026-11-08 23:26–23:55 UTC at 7f44aef.

| Req | Plan(s) | Unit evidence (files · mode · pass/fail) | E2e evidence (specs · mode · pass/fail) | Trace | Requirement status |
|---|---|---|---|---|---|
| VIZ-01 | 03-02, 03-05, 03-06 | lens + tessellation · filt · 35/0 | view.spec · filt · 6/0 | PASS | Complete (unchanged) |
| VIZ-02 | 03-03, 03-07 | frame + mesh-protocol · filt · 32/0 | view.spec · filt · 18/0 | PASS | Complete (unchanged) |
| VIZ-03 | 03-01, 03-09, 03-10, 03-11 | rim + camera-math + text · filt · 26/0 | view-controls.spec · filt · 26/0 (10 project skips) | PASS | Complete (unchanged) |
| VIZ-04 | 03-05, 03-08 | tiers.test · **file** · 4/0 (no ID in titles) | view.spec · filt · 4/0 | PASS | Complete (unchanged) |
| VIZ-05 | 03-03, 03-12, 03-13 | heat + cividis + format + label-layout · filt · 32/0 | view-heat.spec · filt · 28/0 (2 project skips) | PASS | Complete (unchanged) |
| VIZ-06 | 03-04, 03-05, 03-15 | mesh-protocol + mesh-client + transfer · filt · 25/0 | view.spec · filt · 2/0; view-memory + worker + view · file · 81/0 (D-27 1/0 desktop); test:perf 2/0 (informational) | PASS (automated) | **Pending**: the real-phone part (Pixel 7 Pro, incl. ENG-09 (c) with 3D + comparison) is Task 3 |
| RES-03 | 02-08, 03-14 | compare + mesh-protocol + camera-math · filt · 19/0 | compare + view-compare · filt · 9/0 (5 project skips); file 56/0 | PASS | Complete (unchanged; "phase 2 + 3 parts done" note in Task 3) |
| UX-02 | 02-02, 02-10..13, 03-12, 03-13 | — | expert + view-heat · filt · 6/0; file 90/0 | PASS | Complete (unchanged) |
| UX-03 | 02-02, 02-14, 03-06, 03-15, 03-16 | — | view.spec · filt · 6/0 (6 desktop skips); layout + view + a11y · file · 120/0 | PASS | Complete (unchanged); the real-phone items (thumbnail while editing, Android bar over L PD from 02-15) are re-checked in Task 3 |

Result: 9/9 rows PASS. REQUIREMENTS.md is **not** changed in this task; Task 3 step 5 owns it. Its current state matches the table: 8 Complete, VIZ-06 Pending.

Limits of this trace, stated plainly:
- The e2e "filt" counts are title matches. They prove that tests named for the requirement are green, not that every sub-behaviour has its own test. The per-behaviour mapping is the 03-VALIDATION table.
- UX-02 and UX-03 have no unit test tagged with their ID. Their evidence is e2e only.

## MCP matrix (orchestrator)

Run by the orchestrator on 2026-11-09 with the chrome-devtools MCP against `vite preview` on port 4180 (build of 7f44aef; the no-WebGL row re-checked after f52ac80). That Chrome (156) renders with a **real GPU**: `ANGLE (AMD, AMD Radeon RX Vega M GH Graphics (radeonsi vegam ACO), OpenGL ES 3.2)`, read via `WEBGL_debug_renderer_info`. Its numbers are a desktop-GPU proxy, not phone numbers. The MCP `take_screenshot` hangs once WebGL is mounted (known issue), so the screenshots are Playwright stage shots on the same build (orchestrator, after 03-09 … 03-16, listed in session.md), and the MCP part is DOM, console, memory and timing.

**State matrix at 412×915 (DPR 2,625, mobile, touch), one script, no page errors:**

| State | Canvas accessible name (start) | Visible labels | Renderer memory |
|---|---|---|---|
| default | "3D-Ansicht der Brille, schräg von vorne. Rechtes Glas: dickste Stelle 4,6 mm außen oben …" | R, L | 21 / 6 / 11 |
| Vorne | "… von vorne …" | R, L | same |
| Seite | "… von der Seite (rechtes Glas) …" | R | same |
| Oben | "… von oben …" | R, L | same |
| Ansicht zurücksetzen | "… schräg von vorne …" | R, L | same |
| Dickenkarte OD | "Dickenkarte, von vorne. Dünnste Stelle 1,8 mm, dickste Stelle 4,6 mm …" | 1,8 · 3,3 · 4,1 · 3,0 · 3,0 · dickste 4,6 · iso 2,0 (equal to the table) | same |
| Dickenkarte OS | same pattern | 1,8 · 3,1 · 4,0 · 3,0 · 3,0 · dickste 4,6 (equal to the table) | same |
| Vergleich, Dickenkarte | "Vergleich rechtes Glas, von vorne. Vorher (A): dickste Stelle 4,6 mm. Nachher (B) …" | iso labels + Vorher (A), Nachher (B); note "Für die Zahlen am Glas ist die Ansicht zu klein – alle Werte stehen in …" | same |
| Vergleich, Glas / show A | "Vergleich rechtes Glas, schräg von vorne …" | Vorher (A), Nachher (B) | same |
| Vergleich beendet, Expert aus | "3D-Ansicht der Brille, schräg von vorne …" | R, L | same |

Every row: `scrollWidth` 412 = `innerWidth`. Results (`#result` top 3359 px) come before the view (top 4609 px) in document order (MAJOR 5). `list_console_messages` (error, warn): none.

**4× CPU throttle at 412×915 (real GPU, workers unthrottled):**
- Orbit, 3 s of keyboard rotation on the focused stage (azimuth −35° → 130°): 178 frames, median 16,7 ms, p95 16,8 ms, max 16,8 ms (rAF intervals; the display is 60 Hz, so this is the vsync cap). A synthetic touch-pointer drag did not move the camera (untrusted pointer events), so the keyboard path was used.
- Re-mesh with the 3D view on screen (bar hidden): "3D-Neuaufbau zuletzt" over 10 Sph edits 32,5–81,2 ms (first 81,2, then 35,8–48,9).
- Re-mesh with the inputs on screen and the phone bar + thumbnail visible: 23,1–29,0 ms over 10 Sph edits; **no long task (> 50 ms) on the main thread** (PerformanceObserver `longtask`). On this GPU the 03-15 SwiftShader stall (~1,3 s) does not appear; the Pixel measurement in Task 3 is still the binding one.
- Tier shown in Technische Angaben: "Qualitätsstufe mittel (Telefon: Glasdurchsicht in halber Auflösung, ohne Farbsäume)".

**Memory:**
- 412 px: 24 Sph edits → renderer 21 / 6 / 11 unchanged, JS heap 24,9 MB after the runs.
- 1280×800: 20 Sph edits during a comparison → 21 geometries, 6 textures, 12 programs, JS heap 50,0 → 52,8 MB. **12 programs is the count from page load on this GPU at 1280 px** (checked after a reload: 12 at load, through Expert, Dickenkarte, compare and edits, and over 20 further edits). Headless Chromium counts 11. Constant, so not a leak, but the D-27 "expected 11" holds only for the headless environment.
- A DevTools heap snapshot was not taken (the MCP screenshot/snapshot tools hang with WebGL mounted); `performance.memory` was used instead.

**320×640 `?nowebgl`:** the note "Ihr Browser kann die 3D-Ansicht nicht anzeigen (WebGL 2 fehlt oder ist ausgeschaltet). Alle Werte, der Vergleich und der Querschnitt funktionieren trotzdem." shows; `scrollWidth` 320. **Finding (fixed in f52ac80):** before the fix the 4 disabled preset buttons stayed visible, the keyboard hint ("Pfeiltasten drehen …") stayed in the accessibility tree via the stage's aria-describedby, and the canvas kept role=img without aria-hidden. Console: only the deliberate warning "3D view: no WebGL2".

**1280×800:** the view and the results share the right column (stage left 808 px = result left), view above the cards (D-13); "3D drehen" hidden (fine pointer); Dickenkarte callouts 1,8 · 3,3 · 4,1 · 3,0 · 3,0 · dickste 4,6 with iso labels 2,0 · 3,0; split comparison shows the table-only note (known item); no console messages.

### Supporting evidence: Playwright screenshots (not the MCP matrix)

Headless Chromium with SwiftShader, reduced motion, on `vite preview` at port 4174 (stopped afterwards), example prescription, frame Rechteckig 52□18, CR-39. The files are in `/tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/shots17/`, named `<W>x<H>-<state>.png`, plus `facts.json` with the debug-handle state per shot. I looked at the images marked "looked at"; the rest are described from `facts.json`.

| State | What it shows |
|---|---|
| 412 default (looked at) | Both lenses in a black rectangular frame, oblique front view, over the checkerboard + letter band. Badge "Visueller Eindruck", eye labels R and L, the toolbar (Vorne, Seite, Oben, Ansicht zurücksetzen, 3D drehen), the touch hint, the caption, and the protrusion block: "Rechts: Glasrand hinten 1,6 mm aus der Fassung, vorne bündig", "Rechts: Vorderfläche bis zu 0,5 mm vor der Fassung", the same for Links, the assumed-rim-depth note and "Die Aufteilung nach vorne und hinten ist angenommen." Tier 'mittel'; memory geometries 21 / textures 6 / programs 11 |
| 412 Seite (looked at) | Side view of the right lens: black rim, the grey-green edge band standing out behind the rim, the temple going back. The side note "Seite: Blick auf den äußeren Rand des rechten Glases." The protrusion text is the same as in default. **As 03-11 recorded, the 0,5 mm front-surface lead is not visible in the picture; it exists only as the text line** |
| 412 Vorne / Oben | viewName 'front' / 'top', aria "von vorne" / "von oben", both eye labels, memory unchanged |
| 412 Dickenkarte R (looked at) | Cividis map of the right lens in the heat pose with 6 callouts (1,8 mm centre, 3,3 nasal, 4,1 temporal, 3,0 top, 3,0 bottom, "dickste 4,6 mm"), iso lines and one iso label "2,0". The legend runs 1,5…5,0 mm ("Linien alle 0,5 mm"), the eye picker, and the table stacked as one card per row. The table values equal the callouts |
| 412 Dickenkarte L | 6 callouts (1,8 / 3,1 / 4,0 / 3,0 / 3,0 / dickste 4,6 mm), no iso label kept |
| 320 Dickenkarte R and L | Table-only, as 03-13 recorded: `calloutsFit false`, the note "Für die Zahlen am Glas ist die Ansicht zu klein – alle Werte stehen in der Tabelle.", iso labels "2,0" and "3,0" |
| 1280 Dickenkarte R and L | All 6 callouts for both eyes; R also has iso labels "2,0" and "3,0". The canvas name switches to "Dickenkarte, von vorne. Dünnste Stelle 1,8 mm, dickste Stelle 4,6 mm …" after the 500 ms debounce (checked separately: immediately after the switch it still had the Glas name, after 800 ms it had the heat name, which is the specified debounce) |
| 412 A/B (looked at) | Split: "Vorher (A)" CR-39 and "Nachher (B)" 1,74, both right lenses at the same size (131,7 / 131,6 px wide). The caption "Rechtes Glas im Vergleich – gleicher Maßstab, gleicher Blickwinkel." The protrusion block shows **B's values for both eyes** ("hinten 0,5 mm", "Vorderfläche nicht vor der Fassung"): the known 03-14 open item |
| 1280 A/B (looked at) | The same split in the 400 px column (136,3 / 136,2 px), with the mouse/keyboard hint |
| 320 A/B (looked at) | Toggle mode (`split: false`), one viewport with the "Nachher (B)" caption |
| 412 bar (looked at) | Page scrolled to the bottom; the sticky bar shows the 48×36 thumbnail (a single lens: the cropped B half, OD 43,9 px wide) and "Dickste Stelle · Gewicht R 3,0 mm · 5 g \| L 3,0 mm · 5 g". There is **no "Nachher (B):" prefix**: the known 03-16 open item. thumbInfo: 12 copies, 2 passes per thumbnail frame |
| 320 bar | thumbInfo 2 passes per thumbnail frame, lens 44,3 px wide in the thumbnail |
| 412 no-WebGL (looked at) | A grey stage with the info icon and "Ihr Browser kann die 3D-Ansicht nicht anzeigen (WebGL 2 fehlt oder ist ausgeschaltet). Alle Werte, der Vergleich und der Querschnitt funktionieren trotzdem." **The four preset buttons stay visible and disabled below it** (checked: `#view-tools` not hidden, all four `disabled`, `#view-canvas` without `aria-hidden`). See "Watch first" |
| MAJOR 5 order | 412×915: `#result` top 3 400 px, first card ("Rechtes Glas (R) … am dicksten 4,6 mm außen oben") at 3 456 px, `#view-slot` at 4 650 px, so the view follows the result. 320×640: 3 808 / 3 864 / 5 240 px. 1280×800: the view is first in the results column (D-13: view 185 px, result 939 px) |

Console during the shots: 1280 and 320 had no messages. 412 had only the whitelisted Chromium driver note "GPU stall due to ReadPixels" (4×; helpers.js documents it as not an app message). The no-WebGL page logged the app's own `console.warn('3D view: no WebGL2', …)` from scene.js:100.

## Quick-run latency

`npm test` (unit project, no coverage): `Test Files 46 passed (46)` · `Tests 1787 passed (1787)` · **52,27 s wall** (`/usr/bin/time`), within the 120 s feedback budget in 03-VALIDATION. The full e2e suite takes 16,3 min, far above 120 s; 03-VALIDATION's "Estimated runtime about 120 seconds" for the full suite is out of date.

## lens-critic input (step 6)

The orchestrator runs lens-critic on the phase result and inserts the verdict below. Items to weigh:

### From the plan's must-haves
1. **D-04(c) split tolerance (user-accepted 2026-11-08):** ≤ 0,01 mm for nₑ ≥ 1,49; ≤ 0,025 mm for custom nₑ < 1,49. Measured worst case 0,0231 mm (custom nₑ 1,43, −6,00 −3,00 × 45, Rechteckig 62×55/14, PD 25; 03-02). The margin is small.
2. **Deliberate phase-2 change: the bevel rule '1:2'** (apex at t/3 from the front, Essilor US 8 388 133 B2, [ASSUMED] choice). The phase-2 rim text changed: `edgeBeyondRim` and `frame.rim.over` were removed; the Expert rim lines come from `bevelSplit`, plus the new front-surface lead line (03-01, user decision 2026-11-08).
3. **m6 stays deferred.** Wording for deferred-items.md: "m6 (lay note for very thick results): stays deferred after phase 3. The 3D view and the Dickenkarte now show the thickness directly, and 03-RESEARCH found no citable threshold for a 'very thick' note, so none is invented. Revisit only with a sourced threshold."
4. **m7 stays deferred.** Measured Simple page height at 360×780 with the 3D view loaded: **8 771 px** (02-15: ≈ 7 850 px before the 3D view). At 412×915: 8 353 px; at 320×640: 9 431 px.
5. **Assumed design values** ([ASSUMED], no manufacturer source): 4 mm rim face (`FRAME_FACE_MM`), 0,5 mm lip (`RIM_LIP_MM`), 140 mm default temple (`TEMPLE_DEFAULT_MM`, drawn length clamped to [110, 160] mm), 30° / 35 mm earpiece bend, 200 mm chart distance (`CHART_DISTANCE_MM`), and the 3,0 mm default rim depth that the UI labels as assumed.
6. **Revision-1 decisions from the plan review:**
   - the dedicated mesh worker (MAJOR 3; D-26 revised);
   - the phone placement of the view below the result section (MAJOR 5, D-14 revised);
   - the eye-fitted Seite and Dickenkarte framing with derived control limits (MAJOR 2/4);
   - the all-or-nothing callout rule;
   - the front-surface lead line (MAJOR 1);
   - the common rim plane (MINOR 9);
   - the MINOR 1 rebuttal (compile() uses scene.traverse).

### Orchestrator amendments
- **A1:** the default and Oben presets fit the projected frame silhouette, aspect-aware and perspective-exact, + 8 %, centred. R–L 103,6 px at 412×915 (was 42,6 px). The orbit pivot moved off the bridge centre (03-09).
- **A2:** the chart rectangle (`chartRect`) covers the stage over the whole zoom range in default, Vorne and both heat poses (03-09).
- **A3:** the keyboard hint fades after 4 s; a hidden hint is no label obstacle, so the callouts return (03-14). This relieves the 03-13 "keyboard focus gives table-only" item.
- **A4:** the bar thumbnail pass hides the eye chart and the contact shadow, so the glasses show on the plain #f3f4f6 background. Still 2 passes, no new GPU resources (03-16).

### Code-review fix behaviour choices (03-REVIEW-FIX.md; a human should confirm these)
- **B-WR-04:** leaving Dickenkarte (to Glas, or by turning Expert off) returns to the default pose with the default fit (tween, or a cut under reduced motion). The UI-SPEC records the rule.
- **B-WR-07:** "3D drehen" **refuses to switch on** while less than 50 % of the stage is visible (the simpler of the two options); the auto-off rule is unchanged.
- **New string `tech.view.reason.error`:** 'Fehler beim Aufbau der Ansicht'. It is used for a mount/update error (A-WR-02: no retry button, `view.contextGone` text) and for a mesh job lost twice (B-WR-06: `view.loadFailed` text in the Fehler tier; the next input recovers).
- Also in the fixes: A-WR-01 (a throwing `send` falls back to sync mode one task later), B-WR-03 (no thumbnail copy while a mesh job is in flight), B-WR-05 (an interrupted tween marks the view 'free'), B-WR-08 (no camera input before the first mesh attach).
- One fixer gap stays open: it did not run the baseline full suite to show that the view-memory `allocPage` 11-vs-10 event was pre-existing. In this gate run it did not occur (allocPage 10 → 10).

### Open Info items from 03-REVIEW.md
The review lists 14 Info items. A-IN-05 was fixed with A-WR-02 (324de3a), so **13 are open**:
- **B-IN-06: `window.__eyeglassView` ships in production.** It is frozen and returns no Rx, but `pixels()`/`pixel()` force a synchronous render and GPU readback from any script on the shared github.io origin. Suggested fix: gate it behind `import.meta.env.DEV` or a `?testhandle` flag. **Decide before the push.**
- **A-IN-06: retry after a failed dynamic import is verified only in Chromium.** Safari/iOS behaviour for a failed module fetch is unverified (from memory in the review). Fallback suggestion: reload the page when the second import rejects.
- A-IN-01: the 3D chunk also loads from non-result triggers (Expert toggle, stamp/rim keystrokes, cmp-show, compare start/end).
- A-IN-02: invalid mesh items echo their input buffers with `reallocated: false`, against the documented contract.
- A-IN-03: the bevel sentence hard-codes "ein Drittel" with no test tying it to `BEVEL_RULE`.
- A-IN-04: DBL = 0 passes the protocol and gives a non-finite bridge. It is unreachable through the UI (14…24).
- A-IN-07: the stacked heat table uses `display: block` on table elements; VoiceOver may drop the table semantics (unverified).
- B-IN-01: the thumbnail pass inherits the near-temple fade in Seite.
- B-IN-02: `chartRect` can throw inside `refresh()` at a stage aspect of about 7,5 or more (unrealistic).
- B-IN-03: label and caption size caches are not invalidated on text zoom or a late font load.
- B-IN-04: the A slot dispersion follows OD (B) while A is recomputing, which can rebuild a program.
- B-IN-05: heat callouts, legend and table outlive a just-hidden eye until the next attach; eye labels lead the mesh on a DBL change.
- B-IN-07: a heat-eye radio can be disabled while it holds focus (focus drops to `<body>`).

### Open UI items from the summaries
- **No on-lens callouts in split Dickenkarte at ≥ 360 px** (1280 and 412 are table-only in A/B; 03-14). The table and `#cmp-diff` carry the numbers.
- **Sparse iso labels on phones** (1 of 6 at 360/412, 2 at 1280; 03-13). Every line labelled would need an engine change to `isoLabelPoints`.
- **The front-surface lead is text-only in Seite** (03-11). For the example the rim front face hides the 0,5 mm lead in a pure side silhouette, so the UI-SPEC D-30 item "front surface visibly ahead of the rim" is not met by the picture. Confirmed again in the 412 Seite shot.
- **`#view-protrusion` describes B for both eyes during a comparison** (03-14). Confirmed in the 412 A/B shot.
- **No 'Nachher (B):' prefix in the bar** while A gets 'Vorher (A):' (03-16). Confirmed in the 412 bar shot.
- **The thumbnail GPU stall must be measured on the Pixel** (03-15): 1 373,6 ms per re-mesh in SwiftShader with the bar shown, against 59,6 ms without the bar.
- Captions sit over the upper rim on phones in A/B (03-14).
- **New (this task):** the no-WebGL state keeps four disabled preset buttons and an un-hidden `role="img"` canvas (the A-IN-05 pattern).
- `layout.spec.js:302` is known to be timing-flaky (pre-existing); it passed in this run.

### Task 2 checkpoint: user answers (2026-11-09, verbatim)

- M1 question → "Accept new limit (Recommended)": the restated D-04(c) bound is accepted (recorded in 03-CONTEXT.md D-04(c)).
- Push question → "Push now (Recommended)": fast-forward push of main approved, no force.
- Accepted open findings: M1 (user, restated bound). lens-critic accepted MINOR 1, 7 and 10–14 itself. VIZ-06 stays Pending until the Pixel 7 Pro measurement in Task 3.

### lens-critic verdict

**NEEDS WORK** (0 BLOCKER, 2 MAJOR, 14 MINOR), reviewed at 7f44aef + f52ac80 + e5f1061. Full review in 03-LENS-CRITIC-RESULT.md (edf2dc9); fixes in 03-LC-FIX.md (45781a1 … 11f5237).

- **M2, fixed (45781a1):** while comparing, `#view-protrusion` shows only the compared eye as labelled "Vorher (A):" and "Nachher (B):" pairs. The orchestrator checked this in the chrome-devtools MCP at 412×915 (real GPU), CR-39 against 1,74:
  - A: hinten 1,6 mm, front lead 0,5 mm;
  - B: hinten 0,5 mm, no front lead;
  - the bar reads "Nachher (B): …";
  - no console errors, no overflow, memory 21/6/11.
- **M1, open, needs the user's re-acceptance:**
  - The executor's full scan of 58 552 lenses shows that lens-critic's restatement does not hold either. 10 lenses with etMax 31–35 mm exceed 0,01 mm (worst 0,01736 mm). The worst relative error is 0,559 %, not ≤ 0,25 %.
  - A bound that matches the data: ≤ 0,01 mm (≤ 0,025 mm for nₑ < 1,49) up to etMax 31 mm; beyond that ≤ 0,11 mm absolute or ≤ 0,6 % of the local thickness.
  - The test now carries regression limits just above the measured worst cases (35dd6b9).
- **MINOR 2, 3 (A5), 4, 5, 6, 8:** fixed. **MINOR 9:** no change needed. **The rest:** accepted by lens-critic.
- **Gate at 35dd6b9:**
  - lint 0;
  - 1 799 unit tests, coverage 98,91 % statements / 96,87 % branches;
  - e2e 563 passed / 2 failed / 37 skipped;
  - both failures passed when re-run alone. `layout.spec.js:302` is a timing race that already fails on the baseline edf2dc9 (3 of 8 runs).

## Deviations from Plan

1. **[Orchestrator adjustment] Step 4 (MCP matrix) not run by this executor.** The chrome-devtools MCP is not available here. There is a placeholder section for the orchestrator, plus Playwright screenshots as supporting evidence.
2. **[Orchestrator adjustment] REQUIREMENTS.md not touched; STATE/ROADMAP plan progress not advanced.** The plan is not complete.
3. **e2e command form:** `npx playwright test --reporter=list,json` instead of `npm run test:e2e`. The npm script is `playwright test`, so this is the same run plus a JSON report for the trace.
4. **03-VALIDATION.md "File Exists" column** keeps the planner's pre-build marks (❌ W0 / ✅ extend). A note under the table says that all named files now exist. Rewriting 31 cells would hide what Wave 0 had to create.

## Known Stubs

None (docs-only task).

## Threat Flags

None. Task 1 changes documentation only.

## Task status

| Task | Status | Commit |
|---|---|---|
| 1 Gate, trace, VALIDATION, lens-critic input | done (MCP matrix and lens-critic verdict owed by the orchestrator) | this docs commit |
| 2 Push approval | not started (blocking user checkpoint) | — |
| 3 Push, live check, Pixel 7 Pro, REQUIREMENTS.md | not started | — |
