---
phase: 01-verified-engine-live-pipeline
plan: 14
subsystem: ui-timing-and-phone-proxy
tags: [gap-closure, gap-2, eng-09, l10n-02, minor-11, d-b]
requires:
  - 01-12 Grenzfall and the rescan-path finding
  - 01-13 page (update(), measure(), runBench(), renderDiagnostics)
provides:
  - "src/state/memo.js memoLast(fn): JSON key of the full spec, last result reused"
  - "src/state/frame-scheduler.js createFrameScheduler(requestFrame, run, now): one run per frame, earliest input timestamp"
  - "src/state/bench-cases.js specFor, NORMAL_PAIR, GRENZFALL_PAIR, frameMissPair(k), BENCH_RUNS: one definition for the Node bench, the page and 01-11 case A"
  - "Page: work and latency medians of the last 10 edits (#timing-input); three readouts #timing / #timing-frame / #timing-worst"
  - "Per-eye reuse: memoLast(evaluateLens) per eye plus render skip"
  - "MINOR-11: role=status diagnostic boxes rewritten only when the content changes"
  - "e2e/perf-throttled.spec.js + npm run test:perf: CDP CPU-throttled phone proxy (informational)"
affects: [01-11 (case A = NORMAL_PAIR, reads the readouts; step 0 greps the Task 4 decision line), lens-critic result review]
tech-stack:
  added: []
  patterns:
    - "rAF + setTimeout(0) to time from the start of the frame callback to after paint"
    - "Test-only page.route serving unbundled src/ modules so the throttled renderer can time specs the page cannot enter"
key-files:
  created:
    - src/state/memo.js
    - src/state/memo.test.js
    - src/state/frame-scheduler.js
    - src/state/frame-scheduler.test.js
    - src/state/bench-cases.js
    - src/state/bench-cases.test.js
    - e2e/perf-throttled.spec.js
  modified:
    - src/ui/main.js
    - src/i18n/de-AT.js
    - index.html
    - test/bench/recompute.test.js
    - e2e/smoke.spec.js
    - playwright.config.js
    - package.json
    - .planning/phases/01-verified-engine-live-pipeline/01-VALIDATION.md
decisions:
  - "[01-14]: Input timing = rAF + setTimeout (Nolan Lawson 2018); work = frame start → after paint, latency = event.timeStamp → after paint, medians of the last 10 edits"
  - "[01-14]: The page renders per eye via memoLast(evaluateLens); evaluatePair is used only by the bench readouts (raw, no memo)"
  - "[01-14]: Proxy kept out of the CI gate: project 'perf' exists only with PERF=1 (npm run test:perf)"
  - "[01-14]: Host BenchmarkIndex 2221 (Lighthouse computeBenchmarkIndex, Chrome 158) = above the Lighthouse High-End Desktop range 1500–2000, so 4× is the table's suggested mid-tier-mobile multiplier, not a conservative one"
  - "[01-14]: Task 4 decision web-worker (user: \"Worker + RAIL target (Recommended)\"); Web Worker and RAIL-based ENG-09 restatement go to gap plan 01-15"
  - "[01-14]: 4× FAIL (rescan-path pair 178,05 ms, Grenzfall 64,35 ms); the normal case passes at 4× (12,10 ms compute, 15,25 ms work) and fails at 6×"
metrics:
  duration: 15min
  completed: 2026-11-06
  tasks: 4
  files: 15
---

# Phase 1 Plan 14: Honest timing, coalescing, per-eye reuse and the CPU-throttled phone proxy Summary

The page now reports two separate timings, work and latency, each as the median of the last 10 edits. It recomputes at most once per frame and only for the eye that changed, and it shows three bench readouts built from one shared case definition. Diagnostic boxes are not re-announced when their text is unchanged. The CPU-throttled phone proxy ran before any push. **Result: 4× FAIL.** The 01-12 Grenzfall takes about 64 ms per pair at 4×, and the rescan-path pair takes about 178 ms. The normal case passes at 4× and fails at 6×.

Decision (Task 4): web-worker

- User's answer, quoted verbatim from the question dialog on 2026-11-06: "Worker + RAIL target (Recommended)"
- Option text: "New gap plan: move the calculation into a Web Worker so typing never freezes. Restate ENG-09 to the RAIL model (web.dev, cited from memory, to be checked): input handling stays under one frame, a normal result appears within 100 ms, extreme cases show \"rechnet …\" until done. Then re-review, push, and the real-phone check."
- ENG-09 will also be restated to a RAIL-based target in the follow-up plan 01-15, which the orchestrator plans next. REQUIREMENTS.md is not changed in 01-14.

## ENG-09 phone proxy

### Verified API lines (re-checked against the installed and the fetched sources)

- `Emulation.pdl`, fetched 2026-11-06 from https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Emulation.pdl. The command is not marked `experimental`:
  ```
    # Enables CPU throttling to emulate slow CPUs.
    command setCPUThrottlingRate
      parameters
        # Throttling rate as a slowdown factor (1 is no throttle, 2 is 2x slowdown, etc).
        number rate
  ```
- `node_modules/playwright-core/types/types.d.ts` (playwright-core 1.65.0):
  - line 10382: `* **NOTE** CDP sessions are only supported on Chromium-based browsers.`
  - line 10388: `newCDPSession(page: Page|Frame): Promise<CDPSession>;`
- Both match the plan's context block.

### Host and host class

- `lscpu | grep "Model name"`: `Intel(R) Core(TM) i7-8809G CPU @ 3.10GHz`. Browser: Playwright Chromium, UA `Chrome/158.0.8127.18`.
- **Host class (measured):** Lighthouse BenchmarkIndex **2221** at 1× (one sample).
  - Method: `computeBenchmarkIndex` was copied verbatim from https://github.com/GoogleChrome/lighthouse/blob/ea58ed1fd36cb8378a4080dbcb41cdc0e5a581b2/core/lib/page-functions.js (Apache 2.0) into the spec and run with `page.evaluate`.
  - Lighthouse table (docs/throttling.md, "as of Chrome m86"): High-End Desktop 1500–2000, Low-End Desktop ("Intel NUC i3") 1000–1500, High-End Mobile 800–1200, Mid-Tier Mobile ("Moto G4") 125–800, Low-End Mobile < 125.
  - **This host is at or above the High-End Desktop range.** It is not in the Low-End Desktop class that the word "NUC" would suggest. Caveat: the table dates from Chrome m86, and this run used Chrome 158, so index values may have drifted.
- **Consequence for the label.** Lighthouse says its default 4× "moves a typical run in the high-end desktop bracket somewhere into the mid-tier mobile bracket", and it gives 4× (range 2–10) for High-End Desktop → Mid-Tier Mobile. It adds: "If your device's BenchmarkIndex falls on the _higher_ end of its bracket, use a _higher_ multiplier". So **4× is the table's suggested mid-tier-mobile proxy for this host, not a conservative one.** Following the docs, 6× is at least as plausible.
- BenchmarkIndex measured inside the throttled renderer: 2× → 989 (High-End Mobile range), 4× → 504 (Mid-Tier Mobile), 6× → 348 (Mid-Tier Mobile).

### Method

- `npm run build && PERF_OUT=<scratchpad>/perf-run1.json npm run test:perf`: 1 test, passed in 3,2 min.
- For each rate in [1, 2, 4, 6]:
  - a fresh page load, then `newCDPSession(page)` and `send('Emulation.setCPUThrottlingRate', { rate })`;
  - BenchmarkIndex;
  - open #tech, then click #timing-rerun 3 times and parse each readout (each tap = 50 raw `evaluatePair` runs);
  - the rescan-path pair and the Grenzfall, each 3 × 50 runs through the unbundled engine sources (see below);
  - case A, then case B: 10 OD-Sph edits each, then the #timing-input medians;
  - finally reset to rate 1.
- **Rescan-path pair.** +11,75 −5,25 × 5, CR-39, rund 43×55/20, PD 27, **FH 0** (01-12 finding).
  - The page has no fitting-height field (D-04), so this pair cannot be entered on the page.
  - It is timed in the same throttled renderer. A test-only `page.route('**/__src/**')` serves the real `src/` modules unbundled, and `page.evaluate` imports them, so the engine code is the same as the page's.
  - The source-path Grenzfall row is a cross-check against #timing-worst. It reads about 7–11 % higher (unbundled vs. bundled code).
- **Case B as typed** is the Grenzfall entered on the page. Without an FH field the page computes **FH null, not FH 0**. That is a lighter lens: in Node it takes 7,7 ms per pair against 12,9 ms for FH 0, with CT 7,69 mm against 18,64 mm. The exact FH-0 Grenzfall is therefore the #timing-worst readout.
- Medians are in ms. Each readout cell gives the median of the 3 tap medians, with the range across taps in brackets.

### Table

| Row | 1× | 2× | 4× | 6× |
|---|---|---|---|---|
| BenchmarkIndex | 2221 | 989 | 504 | 348 |
| Readout normal (−4,00/−2,00 × 30°, Rechteckig 52×38/18, PD 32, CR-39): median [taps] / p95 | 2,30 [2,30–2,30] / 2,60 | 6,10 [6,00–6,10] / 6,50 | 12,10 [11,90–12,20] / 13,60 | 18,10 [18,10–18,15] / 19,40 |
| Readout normal, outline-cache miss (frame width changed every run) | 2,70 [2,70–2,80] | 7,10 [7,00–7,10] | 14,20 [14,15–14,35] | 21,35 [20,90–22,10] |
| **Readout Grenzfall** (+10,75 −1 × 89, 1,67, rechteckig 43×43/21, PD 36, FH 0): median / p95 | 14,00 [13,90–14,05] / 14,90 | 32,25 [32,20–32,30] / 32,90 | **64,35** [63,70–64,35] / 66,20 | **96,30** [95,80–96,50] / 100,00 |
| Grenzfall via source path (cross-check) | 15,60 | 34,55 | 69,00 | 103,95 |
| **Rescan-path pair** (+11,75 −5,25 × 5, CR-39, rund 43×55/20, PD 27, FH 0; 179/175 evaluations): median / p95 | 40,10 [40,10–40,30] / 42,50 | 88,50 [88,40–88,90] / 90,40 | **178,05** [177,95–178,05] / 182,00 | **267,55** [267,40–268,60] / 282,50 |
| Case A work median (10 edits, normal pair typed) | 3,15 | 6,95 | 15,25 | 22,50 |
| Case A latency median | 12,90 | 14,20 | 21,60 | 31,00 |
| Case B work median (Grenzfall typed, FH null) | 6,15 | 12,35 | 26,85 | 41,10 |
| Case B latency median | 14,50 | 21,30 | **36,00** | **49,65** |

- **Desktop context (1×, Node / vitest).** `npx vitest run test/bench/recompute.test.js`, two runs: normal 3,03 / 3,08 ms; outline miss 3,79 / 3,87 ms; Grenzfall 16,16 / 16,41 ms. 01-12-SUMMARY Grenzfall: 12,47 ms in plain Node and 18,72 ms under vitest. Rescan pair in plain Node (scratch probe): 20,80 ms.
- In Chromium the rescan pair runs at 40 ms at 1×, about twice its plain-Node time. The Grenzfall ratio between Chromium and Node is close to 1. The cause was not investigated.
- Raw JSON: `/tmp/claude-1000/-home-nuc8-05-development-45-brille/beae44f8-9eba-48b3-b7a2-b56ed3dee3bf/scratchpad/perf-run1.json` (scratchpad, not committed). Each rate's row is also printed to the test log.

### Verdict

4× FAIL: the hardest case at 4× is the rescan-path pair at a 178,05 ms median (≥ 16,7 ms). The 01-12 Grenzfall readout alone also fails at 64,35 ms. Case B work is 26,85 ms (FH null), and the outline-miss normal readout is 14,20 ms (passes). The normal case passes at 4×: 12,10 ms compute and 15,25 ms work.

- **6× (finding):** everything fails, including the normal case (18,10 ms compute, 22,50 ms work), the Grenzfall (96,30 ms) and the rescan pair (267,55 ms).
- **2× (context):** the normal case passes (6,10 ms, work 6,95 ms). The Grenzfall (32,25 ms) and the rescan pair (88,50 ms) fail.
- **Latency medians > 33,3 ms:** case B at 4× (36,00 ms) and at 6× (49,65 ms). Case A stays below the bound at every rate (31,00 ms at 6×).

## Timing method and source

- **Source used: Nolan Lawson, "Accurately measuring layout on the web"** (2018-09-25, https://nolanlawson.com/2018/09/25/accurately-measuring-layout-on-the-web/). Fetched 2026-11-06. It describes the pattern `requestAnimationFrame(() => { setTimeout(() => { ...`, and says: "the trick is to queue a setTimeout callback inside of a rAF, which ensures that the second callback happens after style and layout, regardless of whether the browser is spec-compliant or not."
- In main.js:
  - `work` = performance.now() at the setTimeout task − frameStart (start of the rAF callback);
  - `latency` = the same instant − the earliest `event.timeStamp` of the coalesced batch;
  - both are medians of ring buffers holding the last 10 values;
  - the init() frame is excluded.

## RED evidence (Task 1, commit 16b1140)

`npx vitest run src/state` before the implementation:

```
 FAIL  |unit| src/state/bench-cases.test.js
Error: Cannot find module './bench-cases.js' imported from .../src/state/bench-cases.test.js
 FAIL  |unit| src/state/frame-scheduler.test.js
Error: Cannot find module './frame-scheduler.js' imported from .../src/state/frame-scheduler.test.js
 FAIL  |unit| src/state/memo.test.js
Error: Cannot find module './memo.js' imported from .../src/state/memo.test.js
 Test Files  3 failed | 2 passed (5)
```

GREEN (d76507b): 5 files, 58 tests passed. The DOM-free grep returns 0.

## e2e results

- `npm run test:e2e`: **44 passed** (desktop + mobile). New tests, each passing on both projects:
  - 'timing shows work and latency medians (ENG-09)';
  - 'technical details show three readouts';
  - 'one recompute per frame (01-14)';
  - 'unchanged diagnostics are not re-announced (MINOR-11)'.
- **The new tests discriminate**, checked by temporarily breaking main.js; the rebuild and file were restored afterwards:
  - with `onInput = () => update()` (no coalescing), 'one recompute per frame' failed with Expected 1, Received 3;
  - without the diagnostic signature check, MINOR-11 failed with Expected 0, Received 2.
- MINOR-11 case: the oversized reference case from 01-12-SUMMARY (+12, rechteckig 62×55/24, PD 25, CR-39), changed to +11,75.
  - The test asserts that the #diag-od text is identical before and after. It is: BLANK_EXCEEDS_STOCK depends on the frame and PD only.
  - The CT changes, so OD did recompute through a memo miss.
- `npm run test:e2e` lists no perf-throttled test (`grep -c perf-throttled` = 0).

## Gates

- `npm run lint`: exit 0.
- `npm run test:coverage`: 25 files, 1022 tests passed. Engine coverage: 98,45 % statements, 96,38 % branches, 99,17 % lines.
- `npm run build`: ok. `npx vitest run test/bench/recompute.test.js`: 3 passed. `test/ci/pins.test.js`: 6 passed.
- Acceptance greps:
  - `schedule(e.timeStamp)`: 3;
  - `memoLast(evaluateLens)`: 2;
  - `currentSpecs`: 0;
  - `bench-cases` in recompute.test.js: 2;
  - `innerHTML` in src/ui: 0;
  - the tech.* no-digit check exits 0;
  - `Emulation.setCPUThrottlingRate` in the perf spec: 3;
  - `newCDPSession`: 2.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 – Bug] tech.* texts: `p95` and `50` moved out of the dictionary.**
- The plan's own texts ('Median {median}, p95 {p95} ({runs} Läufe)') contain digits, both in `p95` and in the placeholder name `{p95}`. The plan's acceptance check `/\d/` on every tech.* value would fail on them.
- The texts now read `p{pct} {tail}` and `{runs} Läufe`. main.js passes `TAIL_PCT = 95` and `BENCH_RUNS`, which follows the stack rule "numbers never live inside translated strings". The rendered text is unchanged ("p95 … ms").
- Two new keys build the case label from the spec values: `tech.case` and `tech.caseFh`.
- Commit a686858.

**2. [Rule 3] Browser globals in e2e files:** a `/* global … */` comment was added for `page.evaluate` bodies, because the e2e lint config has Node globals only.

**3. [lens-critic amendment 1, binding] Host class measured instead of assumed.**
- The plan's "4× conservative on this NUC host" was replaced by the measured BenchmarkIndex (2221, at or above High-End Desktop).
- The VALIDATION row now reads "host class measured by Lighthouse BenchmarkIndex, see 01-14-SUMMARY" instead of "4× conservative on this host".

**4. [Orchestrator addition 3] Rescan-path pair timed in its own row.** The pair is FH 0, which the page cannot enter, so it is timed through the test-only source route. 1× was also run in the same harness as a baseline.

**5. [Finding] Case B typed ≠ the FH-0 Grenzfall.** The page has no FH field (D-04), so the "Grenzfall typed in" computes FH null. This is documented in the spec and in the table. The exact Grenzfall is covered by the #timing-worst readout and the source-path row.

### Not changed

- No Web Worker (per D-B) and no engine tuning.
- The `test:e2e` script and the CI workflow are unchanged.

### CLAUDE.md adjustments

None. The engine stays pure, the new modules in src/state are DOM-free, and every visible string comes from de-AT.js.

## Requirements

- None marked complete. ENG-09 stays pending: Web Worker and RAIL restatement in 01-15, then the real-phone measurement (01-11 Task 3).
- L10N-02 was already complete. The new tech.* keys keep it: the dictionary test passed under coverage.

## Known Stubs

None.

## Threat Flags

None. The `__src` route and the CDP session exist only in the test harness (T-01-37 boundary "test harness → browser"); the route is path-confined to `src/`. Nothing is shipped.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | 16b1140 | test(01-14): failing tests for memo, frame scheduler and shared bench cases |
| 1 GREEN | d76507b | feat(01-14): per-eye memo, frame scheduler and shared ENG-09 bench cases |
| 2 A | a686858 | feat(01-14): work/latency timing, rAF coalescing, per-eye reuse, canonical bench cases, quiet diagnostics |
| 2 B | cd61f7c | test(01-14): e2e for timing medians, coalescing count and quiet diagnostics |
| 3 | 02cec28 | test(01-14): CPU-throttled phone proxy (D-B) |
| 4 | — | decision checkpoint: web-worker (user, 2026-11-06) |

## TDD Gate Compliance

`test(01-14)` 16b1140 precedes `feat(01-14)` d76507b.

## Self-Check: PASSED

All 7 created files exist, and commits 16b1140, d76507b, a686858, cd61f7c and 02cec28 are in `git log`.
