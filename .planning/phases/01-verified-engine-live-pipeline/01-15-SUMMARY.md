---
phase: 01-verified-engine-live-pipeline
plan: 15
subsystem: compute-worker-and-eng09-restatement
tags: [gap-closure, eng-09, web-worker, rail, inp, latest-wins, settled-signal]
requires:
  - 01-14 frame scheduler, bench cases, timing readouts and phone proxy
  - "01-14 decision web-worker (user: \"Worker + RAIL target (Recommended)\")"
provides:
  - "src/state/compute-protocol.js createHandler/READY/medianOf/tailOf: pure worker-side handler, never throws"
  - "src/state/compute-client.js createComputeClient: per-eye seq latest-wins, cache restore, per-eye busy after 50 ms, onOpenChange, one job in flight with compute first, bench guard, fallback, suspension-aware watchdog"
  - "src/worker/engine.worker.js: module worker glue (8 lines)"
  - "#result[data-pending] settled signal + e2e/helpers.js settled/etmaxOf/slowWorker"
  - "Per-eye 'rechnet …' state: status cell, dotted underline (data-stale), aria-busy, #calc-status (3 lines reserved)"
  - "Readouts: input frame and reaction incl. paint, result frame, input to result painted, worker compute, busy counter and longest wait, Event Timing, four worker bench readouts incl. the rescan-path pair"
  - "ENG-09 restated to RAIL/INP in REQUIREMENTS.md (still Pending)"
  - "e2e/worker.spec.js (9 tests) and the reworked CPU-throttled proxy"
affects: [01-11 (step 0 greps the Task 6 gate line; real phone decides (c)/(d)), lens-critic result review]
tech-stack:
  added: []
  patterns:
    - "Module Web Worker via new Worker(new URL(…, import.meta.url), { type: 'module' }), worker.format 'es'"
    - "Per-eye sequence numbers with a second isCurrent check inside the paint frame"
    - "Deterministic settled signal as a DOM token set that e2e tests wait on"
    - "Init-script Worker wrapper to place an input event inside a worker message task"
key-files:
  created:
    - src/state/compute-protocol.js
    - src/state/compute-protocol.test.js
    - src/state/compute-client.js
    - src/state/compute-client.test.js
    - src/worker/engine.worker.js
    - e2e/helpers.js
    - e2e/worker.spec.js
  modified:
    - src/state/bench-cases.js
    - src/state/bench-cases.test.js
    - src/ui/main.js
    - src/ui/style.css
    - src/i18n/de-AT.js
    - index.html
    - vite.config.js
    - eslint.config.js
    - e2e/smoke.spec.js
    - e2e/perf-throttled.spec.js
    - .planning/REQUIREMENTS.md
    - .planning/phases/01-verified-engine-live-pipeline/01-VALIDATION.md
  deleted:
    - src/state/memo.js
    - src/state/memo.test.js
decisions:
  - "[01-15]: Engine runs in a module Web Worker; one job in flight, compute before the next one-run bench job; per-eye seq latest-wins plus isCurrent re-check in the paint frame"
  - "[01-15]: Sync fallback (dynamic import of compute-protocol) on constructor throw, error before READY, or a 10 s watchdog that re-arms while hidden or when fired late"
  - "[01-15]: ENG-09 restated to RAIL/INP (a)-(d); (a)/(b) measured on the proxy and phone, (c)/(d) decided on the phone"
  - "[01-15]: Proxy at 4x fails (a) as measured: 54,8 ms main-thread input frame in the extreme run (case A 16,3 ms, case B 16,1 ms); diagnostics show the 54,8 ms is a multi-task measurement artifact (no LoAF frame > 50 ms), the real 4x overshoot is the input frame (16,3 ms max, frame gaps 21–30 ms while typing)"
  - "[01-15]: Task 6 decision phone-decides (user: \"Phone decides (Recommended)\"); ENG-09 (a) is an open finding for 01-11 and the real phone"
metrics:
  duration: 50min
  completed: 2026-11-06
  tasks: 6
  files: 21
---

# Phase 1 Plan 15: Engine in a Web Worker, settled signal, per-eye "rechnet …" and ENG-09 restated Summary

Both lenses are now computed in a module Web Worker with per-eye latest-wins. A result more than 50 ms late shows a German "rechnet …" state per eye without moving the page. The page computes directly when the worker cannot start, and says so. A deterministic settled signal is what the whole e2e suite now waits on. ENG-09 is restated to RAIL/INP with re-checked citations. **The 4× CPU-throttled proxy fails criterion (a), which is measured, not estimated.** During the extreme run (keystrokes typed while the rescan bench runs in the worker), one main-thread input frame reaches 54,8 ms. Case A (16,3 ms) and case B (16,1 ms) pass at 4×. Criterion (b) and the estimates for (c) and (d) pass at every rate. Task 6 was decided by the user: `phone-decides`. Orchestrator-authorized diagnostics show that the 54,8 ms spans several tasks and is not one frame. The remaining 4× overshoot of the input frame is an open ENG-09 (a) finding for 01-11.

Proxy verdict (ENG-09 restated): 4× FAIL (a,b measured; c,d estimated): (a) main-thread input frame incl. paint 54,80 ms in the extreme run (≥ 16,7 ms); case A 16,30 ms and case B 16,10 ms pass; (b) 57,10 ms pass; (c) estimate 47,0 ms pass; (d) functional pass, predicted rescan wait 215,4 ms ('rechnet …' expected)

Decision (Task 6): phone-decides

- User's answer, quoted verbatim from the question dialog: "Phone decides (Recommended)"
- Option text: "Go to 01-11: final check run, lens-critic result review, push, then the real-phone check. The small one-frame overshoot is recorded as a finding with these numbers, and the real phone decides. If the phone also misses, a small optimisation plan follows (lighter page work per keystroke)."
- Open finding for 01-11 and the real phone: ENG-09 (a), see "Diagnostics (orchestrator-authorized, no code change)".

## Proxy (Task 5)

### Method

- Run: `npm run build && PERF_OUT=<scratchpad>/perf-run-01-15.json npm run test:perf`. 1 test passed in 1,2 min.
- Raw JSON: `/tmp/claude-1000/-home-nuc8-05-development-45-brille/beae44f8-9eba-48b3-b7a2-b56ed3dee3bf/scratchpad/perf-run-01-15.json` (scratchpad, not committed).
- Host: the same one as 01-14 (i7-8809G); UA `Chrome/158.0.8127.18`.
- Per rate [1, 2, 4, 6]: fresh load, `settled`, then `Emulation.setCPUThrottlingRate` on the page.
  - (i) Worker bench, labelled **worker, unthrottled**: the auto-started bench plus 2 re-runs. Each readout is the median of the 3 bench medians, with the range in brackets, then the median p95.
  - (ii) Case A: 10 OD-Sph fills alternating −4,25 / −4,00. The discriminating etmax values are 7,5 / 7,3 mm.
  - (iii) Case B: the Grenzfall typed (FH null), alternating +11,00 / +10,75. **Discriminated by etmax** (5,6 / 5,5 mm), so the OD-column fallback was not needed.
  - (iv) Extreme run: case A retyped, then #timing-rerun, then a wait until #timing-worst shows a Median (the rescan runs were in progress: `rescanRunningAtStart` true at every rate). Then 10 edits, each `fill('')` + `pressSequentially`, each followed by `settled`. The readouts are read after **every** edit and their maxima kept, because one edit is up to 6 input frames and the ring holds 10.
- Every edit is followed by `settled(page)`. The `__src` route and `timeSourcePair` are gone. There is no worker-throttling attempt and no CPUQuota use (see below).

### Table (ms; de-AT decimals)

| Row | 1× | 2× | 4× | 6× |
|---|---|---|---|---|
| BenchmarkIndex (01-14 in brackets) | 2213,5 (2221) | 927,5 (989) | 520,5 (504) | 344,5 (348) |
| Worker normal, median [range] / p95 (worker, unthrottled) | 2,40 [2,40–2,40] / 2,90 | 2,60 [2,50–2,65] / 2,80 | 2,60 [2,50–2,70] / 2,80 | 2,55 [2,50–2,60] / 2,90 |
| 01-14 main-thread normal median | 2,30 | 6,10 | 12,10 | 18,10 |
| Worker normal, outline miss (worker, unthrottled) | 2,90 [2,80–3,00] / 3,40 | 3,25 [3,20–3,30] / 3,50 | 3,30 [3,20–3,30] / 3,80 | 3,20 [2,90–3,30] / 3,50 |
| Worker Grenzfall FH 0 (worker, unthrottled) | 13,90 [13,75–14,25] / 15,80 | 15,50 [14,70–15,90] / 16,40 | 15,60 [15,60–15,80] / 16,90 | 15,60 [15,40–15,70] / 16,30 |
| 01-14 main-thread Grenzfall median | 14,00 | 32,25 | 64,35 | 96,30 |
| Worker rescan pair (worker, unthrottled) | 36,30 [36,30–36,40] / 38,10 | 40,60 [40,45–41,00] / 43,60 | 40,45 [40,40–40,75] / 44,80 | 40,40 [38,75–40,80] / 41,80 |
| 01-14 main-thread rescan pair median | 40,10 | 88,50 | 178,05 | 267,55 |
| Case A reaction median / max | 11,35 / 12,40 | 14,65 / 16,40 | 25,45 / 28,80 | 35,90 / 44,40 |
| Case A main-thread input frame median / **max** | 1,60 / 1,90 | 2,80 / 7,80 | 14,50 / **16,30** | 21,55 / **29,50** |
| Case A result frame max | 2,20 | 2,10 | 4,00 | 8,70 |
| Case A input → result painted median / max | 28,30 / 30,10 | 27,25 / 28,80 | 31,40 / 34,70 | 46,05 / 57,30 |
| Case A worker compute median | 1,60 | 1,30 | 1,30 | 1,30 |
| Case B reaction median / max | 11,70 / 13,40 | 14,90 / 15,40 | 25,05 / 27,50 | 24,70 / 46,00 |
| Case B main-thread input frame median / **max** | 1,60 / 1,70 | 3,15 / 8,80 | 13,80 / **16,10** | 19,80 / **23,00** |
| Case B result frame max | 1,70 | 2,70 | 4,40 | 9,10 |
| Case B input → result painted median / max | 28,65 / 30,20 | 27,75 / 29,30 | 32,20 / 33,30 | 41,45 / 54,70 |
| Case B worker compute median | 4,70 | 5,10 | 4,65 | 4,65 |
| Extreme run reaction max | 27,30 | 30,70 | 57,10 | 86,70 |
| Extreme run main-thread input frame **max** | **20,30** | **23,40** | **54,80** | **83,20** |
| Extreme run result frame max | 4,10 | 5,10 | 10,80 | 55,00 |
| Extreme run input → result painted median / max (last 10) | 32,65 / 48,20 | 45,55 / 60,20 | 56,60 / 65,30 | 67,60 / 87,60 |
| Extreme run Event Timing, longest of last 10 interactions | 24,00 | 24,00 | 24,00 | 32,00 |
| Extreme run "rechnet …" count / longest wait (page readout) | 2 / 48,20 | 0 / 60,20 | 0 / 65,30 | 1 / 87,60 |
| Extreme run final OD etmax (expected 7,3 mm) | 7,3 | 7,3 | 7,3 | 7,3 |
| **(a) measured**: worst main-thread frame (< 16,7) | 20,30 fail | 23,40 fail | 54,80 fail | 83,20 fail |
| **(b) measured**: worst reaction (≤ 200) | 27,30 pass | 30,70 pass | 57,10 pass | 86,70 pass |
| **(c) ESTIMATE**: overhead = case A result max − compute median | 28,50 | 27,50 | 33,40 | 56,00 |
| **(c) ESTIMATE**: overhead + 01-14 normal p95 (≤ 100) | 31,1 pass | 34,0 pass | 47,0 pass | 75,4 pass |
| **(d) ESTIMATE**: overhead + 01-14 rescan p95 = predicted rescan wait | 71,0 | 117,9 | 215,4 | 338,5 |
| (d) "rechnet …" expected (predicted > 50) | yes | yes | yes | yes |
| (d) functional in the spec (final etmax correct, readouts arrived) | pass | pass | pass | pass |

- The 01-14 p95 values used for the estimates are 2,60 / 6,50 / 13,60 / 19,40 (normal) and 42,50 / 90,40 / 182,00 / 282,50 (rescan pair). They are a constant table in the spec, `COMPUTE14_P95`, cited to 01-14-SUMMARY. The JSON marks `c` and `d` with `estimated: true`, and `a` and `b` with `measured: true`.
- **Functional evidence for (d):** the Task 3 worker tests passed on desktop and mobile (commit 71bf0d9 and the follow-up 316163b): latest-wins, the busy state per eye, cache restore and the German error. This is not a JSON field.

### Verdict lines

- Proxy verdict (ENG-09 restated): 4× FAIL (a,b measured; c,d estimated): (a) 54,80 ms extreme-run input frame
- Finding: 2× FAIL (a,b measured; c,d estimated): (a) 23,40 ms extreme-run input frame; case A 7,80 ms and case B 8,80 ms pass
- Finding: 6× FAIL (a,b measured; c,d estimated): (a) 83,20 ms extreme run; case A 29,50 ms and case B 23,00 ms also fail
- Finding: 1× FAIL (a,b measured; c,d estimated): (a) 20,30 ms extreme-run input frame; case A 1,90 ms and case B 1,70 ms pass

### What the numbers say (for the Task 6 decision)

- **The failing criterion is (a), and it is measured.** In plain edits it holds at 1×, 2× and, only just, at 4× (16,30 and 16,10 against 16,7). It fails in every extreme run, even at 1× (20,30 ms), where plain edits take 1,90 ms.
- **Cross-check that does not fit:** the browser's own Event Timing reports at most 24 ms per interaction for the same extreme runs at 1×, 2× and 4×. The page's "input frame incl. paint" ring reports 20,30 / 23,40 / 54,80 ms there.
- **Hypothesis (UNVERIFIED):** during `pressSequentially`, Playwright's queued key events (keydown/keypress/input/keyup per character) and the worker's bench messages run as tasks between the paint and the rAF + setTimeout end mark. If so, the mark then includes the next keystroke's handling, and the ring value is an upper bound that spans more than one frame. Two checks would settle it:
  - Long Animation Frames entries (`long-animation-frame` PerformanceObserver) during the extreme run;
  - or the extreme run with paced keystrokes (`pressSequentially` delay ≥ 50 ms).
  - Neither was run: Task 6 says "change no code".
- (b) passes everywhere with a wide margin (≤ 86,70 ms against 200). The worker removes the main-thread cost of the slow cases: the rescan pair takes about 40 ms in the worker at every rate, against 178,05 ms on the 01-14 main thread at 4×.
- (c) and (d) are estimates only. The real phone in 01-11 decides them.

### Notes

- **CPUQuota:** `systemd-run --user --scope -p CPUQuota=25%` would be a different model (a quota on all threads, including the worker). It was not used, and nothing relies on it.
- The real phone in 01-11 decides (c) and (d), and also measures (a) and (b) on the live site.

## Diagnostics (orchestrator-authorized, no code change)

These ran after the Task 5 proxy and before the Task 6 decision, as a measurement only. The scratch spec, config and JSON are in `/tmp/claude-1000/-home-nuc8-05-development-45-brille/beae44f8-9eba-48b3-b7a2-b56ed3dee3bf/scratchpad/diag-01-15/`. They ran against the current build; `src/` and the committed specs are unchanged, and nothing was committed.

### Method

- The extreme run is repeated as in Task 5: case A, the rescan bench running in the worker, and 10 OD-Sph edits typed with `pressSequentially`, each followed by `settled`.
- Each edit is typed three ways: with no delay between keys, then `{ delay: 50 }`, then `{ delay: 100 }`. All three run at 1× and at 4×.
- Probes in the page (an init script):
  - a buffered `long-animation-frame` PerformanceObserver;
  - an `event` observer (durationThreshold 16);
  - a rAF loop that records `performance.now()` per callback.
- Only entries inside the extreme-run window are counted.

### Probe validation (80 ms busy-loop control)

- **LoAF:** Chromium 158 lists `long-animation-frame` in `PerformanceObserver.supportedEntryTypes`. An 80 ms busy loop inside one rAF callback gave one LoAF entry at both rates: 95,1 ms at 1× and 80,3 ms at 4×. Its script was `user-callback:FrameRequestCallback` (80 ms), with blockingDuration 30,3 ms. The observer works, so if it reports no entries, there was no frame over 50 ms.
- **rAF intervals:** the browser's rAF timestamps are **not** usable here. A 30 ms busy loop still gave 16,7 ms intervals, so that version was discarded. Intervals taken from `performance.now()` at each callback show the 80 ms loop correctly (80,2 / 80,4 ms), and only those are reported.
- **LoAF limit:** it reports only frames over 50 ms. Frames between 16,7 and 50 ms can be seen only through the rAF intervals.

### Results (ms)

| Rate | Typing | Page: longest input frame incl. paint | Event Timing longest interaction | LoAF frames > 50 ms | Longest gap between frames | Gaps > 20 ms |
|---|---|---|---|---|---|---|
| 1× | no delay | 20,8 | 24 | 0 | 19,3 | 0 of 63 |
| 1× | 50 ms between keys | 3,2 | 24 | 0 | 18,5 | 0 of 171 |
| 1× | 100 ms between keys | 3,1 | 24 | 0 | 17,4 | 0 of 321 |
| 4× | no delay | 52,6 | 32 | 0 | 29,7 | 13 of 73 |
| 4× | 50 ms between keys | 19,1 | 32 | 0 | 21,1 | 1 of 190 |
| 4× | 100 ms between keys | 22,4 | 32 | 0 | 21,6 | 2 of 340 |

- In the first diagnostic run, the unpaced 4× case gave a page value of 56,5 ms and one 40 ms keydown in Event Timing. 9,5 ms of that keydown was input delay.
- The rescan bench was running at the start of every run. It was still running at the end only in the unpaced runs; the paced runs (2,8–5,7 s) outlasted it.
- No LoAF entry exists, so no `scripts[]` attribution is possible.

### Conclusion

- **The 54,80 ms in Task 5 is an artifact.** The page's rAF + setTimeout mark spans several tasks: when Playwright sends keys back to back, the queued key events run between the paint and the mark.
- **No LoAF frame was over 50 ms** in any run.
- **Event Timing max was 32 ms at 4×** (24 ms at 1×).
- **The remaining 4× overshoot is the input frame itself.** For plain edits it is about **14,5 ms median and 16,3 ms max** (Task 5 case A, where no other task runs in between). During unpaced typing, frame gaps are 21–30 ms (13 of 73 over 20 ms). With paced keys, gaps still reach about 21 ms, while the 1× baseline jitter tops out near 19 ms.
- **What runs in those frames is inferred, not attributed** (LoAF does not see frames under 50 ms). It is our input frame (reading the fields, echo, style, layout, paint), plus keystroke handling that lands in the same frame when keys arrive back to back. These are unlikely causes:
  - the bench message handler (≤ 0,2 ms measured);
  - result rendering (result frame ≤ 10,8 ms in the extreme run);
  - GC (no frame over 50 ms, no outlier gap).
- **Open finding for 01-11 and the real phone: ENG-09 (a).** At 4×, the main-thread input frame is at or just over one frame. The real phone decides. If the phone also misses, a small optimisation plan follows (lighter page work per keystroke). The Task 5 verdict line stays as measured.

## Implementation notes

- **Worker file:** `dist/assets/engine.worker-BT7B2Ef6.js` (16,37 kB).
  - `head` shows ES-module output (`const e=e=>1e3*(e-1),…`), and `grep -c importScripts` returns 0.
  - The build also emits a lazy `compute-protocol-*.js` chunk for the fallback and the main `index-*.js` chunk.
- **`lh` decision:** `min-height: 4.5em; min-height: 3lh;` (orchestrator MINOR-7).
  - Checked against MDN browser-compat-data 8.1.8 (`css.types.length.lh`): Chrome and Chrome Android 109, Safari and iOS 16.4, Firefox and Firefox Android 120, Samsung Internet 21.0. The `4.5em` line is the fallback for older engines.
  - **Reserved empty gap:** when idle, #calc-status leaves an empty block below the result table. It is 3 × 1,5 × 16 px = 72 px (computed; lens-critic measured 72 px for both forms in Chromium 158).
- **memo.js removed:** `grep -rn memoLast src test e2e` showed only memo.js and memo.test.js, so both were removed with `git rm` in 9520d9a.
- **No transferables.** A structuredClone round trip is tested for NORMAL, GRENZFALL, RESCAN, SC-4 and `sph: NaN`.
- **CSP unchanged** and checked by exact equality in worker.spec.js. The test records zero `securitypolicyviolation` events and zero console errors.
- **Message cost** (MINOR-13; 20 result deliveries; performance.now around `client.receive`; `page.goto('./?msgprobe')`):
  - desktop median 0,100 ms, max 0,200 ms;
  - mobile median 0,000 ms (one run) and 0,100 ms (another), max 0,200 ms.
  - Measured and recorded. The measurement confirms it is negligible against the 16,7 ms frame. Resolution is limited by the 0,1 ms coarsening of performance.now. It is not part of (a).

## Required RED observations

1. **Task 1, unit seq removal (M3).**
   - With `if (r && r.seq === w.seq)` → `if (r)` in compute-client.js, `npx vitest run src/state/compute-client.test.js` gave **1 failed / 32 passed**.
   - The failing test was 'latest wins: stale OD from job 1 is dropped, OS delivered, one job 2 with the latest OD only'.
   - After the restore: 33 passed. The file was restored from a backup copy, with a clean diff.
2. **Task 2, coalescing (lens-critic r3 M1).**
   - With `onInput = (e) => update(e.timeStamp)` (scheduler bypassed), 'one recompute per frame (01-14)' failed on desktop and mobile on the echo count: **Expected 1, Received 3**.
   - After the restore and a rebuild: 2 passed.
3. **Task 3, discrimination run (test 4 'latest input wins (slow worker)').**
   - Run B removed the client seq check and the main.js `isCurrent` re-check. Test 4 failed on both projects: **Expected 4.7, Received 2.8**. The stale −1 result was painted and accepted, so −3 was never sent.
   - After the restore and a rebuild: passed.
   - Observed etmax sequence after −2 → −1 → −3 with the checks in place, on both projects: `["4,7 mm – oben, schläfenseitig"]`. 2,8 mm (−1) never appears.
4. **Task 3, isolated `isCurrent` re-check (orchestrator MINOR-4).** This is a new test, 'result frame re-checks isCurrent (input between message and frame)'.
   - An init-script Worker wrapper dispatches an input of −3 inside the result-message task, before the page handler runs. The input frame is therefore queued before the delivery frame.
   - Run A removed **only** the re-check. The new test failed on both projects with the sequence `["2,8 mm – oben, schläfenseitig","4,7 mm – oben, schläfenseitig"]` (the stale −1 was painted). Test 4 still passed in that run.
   - With the re-check in place the sequence is `["4,7 mm – oben, schläfenseitig"]`.
   - So the re-check is covered on its own (e2e), not only together with the client seq check.
5. **Task 3, no bench auto-start in sync mode (lens-critic r3 M2).**
   - With the toggle handler changed to `if (tech.open) runBench();`, the fallback test failed on both projects. `#timing` was filled with 'Rechenzeit direkt auf der Seite, Normalfall (…): Median 2,60 ms, p95 4,90 ms (50 Läufe)' where Expected was "".
   - After the restore: passed.

After each RED run, `git diff --stat -- src` was empty and dist/ was rebuilt.

## Adapted smoke tests (settled before every read after an edit)

- 'both eyes show thickness, weight and base curve'
- 'material choice changes thickness': `expect.poll` replaced by a settled read
- 'frame shape and PD change the edge': `expect.poll` replaced; settled after the PD fill and after the shape select
- 'plus cylinder shows both forms' (orchestrator MINOR-3):
  - settled before and after the edit;
  - the regex is tightened to the pinned engine values of +3,00 −2,00 × 180: CT 3,6 mm, etmax 3,2 mm, etmin 1,0 mm, weight 7,0 g;
  - the test also asserts that the −2,00 defaults (1,8 / 3,7 / 2,5 mm, 6,1 g) do not match.
- 'cylinder without axis' (MINOR-3)
- 'SC-4 impossible lens is explained': after the Rx fills and after the material select
- 'oversized lens warns'
- 'very strong plus beyond the model range is explained (01-12)'
- 'normal lens shows Vogel reference'
- 'material line shows the Abbe number (MAT-01)' (MINOR-3)
- 'Vogel raw value with clamp note (MINOR-1)': after both edits
- 'technical details show the timing readout'
- 'timing shows reaction, main-thread and result medians (ENG-09)': rewritten in Task 4, settled after each of the 10 edits
- 'technical details show four readouts': was three
- 'one recompute per frame (01-14)': uses etmax with `et3 !== et25` asserted first, and counts the `#rx-od-sph-echo` mutations
- 'unchanged diagnostics are not re-announced (MINOR-11)': its rAF + setTimeout wait is replaced by settled
- New in Task 4: 'bench re-entry is ignored; compute goes first', 'message handler is negligible (measured, MINOR-13)', 'event timing readout is filled'

These tests read no result after an edit, so they are unchanged: 'German page with visible disclaimer', 'paper-style Sph is echoed' (the echo is synchronous), 'malformed input shows an error, never NaN', 'axis message is specific', 'footer shows the build commit', and the axe test.

## Orchestrator additions (lens-critic r3 MINORs): all applied

1. #calc-status is cleared only when no eye is busy (`onBusy` in main.js). The note stays while the other eye is still busy.
2. `onOpenChange` is specified in the JSDoc and unit-tested:
   - it fires synchronously inside `request()`;
   - queued-but-unsent eyes count as open (tested before READY);
   - it fires on cancel, on `onFailed` (right after it) and on a cache delivery, and not on an unchanged request.
   - An eye skipped by the result-rAF `isCurrent` re-check is removed from the delivered set in `paintDeliveries`. The isolated re-check e2e settles in that situation, so `settled` does not hang.
3. 'plus cylinder' (:102), 'cylinder without axis' (:116) and 'material line' (:208) now use `settled()`. :102 is pinned so that the stale defaults cannot match.
4. The `isCurrent` re-check has its own test (e2e, see RED observation 4).
5. 01-VALIDATION ENG-09 row: "01-15-T4: (a)/(b) measured" → "01-15-T5: (a)/(b) measured".
6. Every line in this SUMMARY matching `[246]× (PASS|FAIL)` carries "(a,b measured; c,d estimated)". The 1× line also carries it.
7. CSS uses `min-height: 4.5em; min-height: 3lh;`. The reserved empty gap is noted above.
8. No status-column reflow at 360 px. Test 5 passes on the mobile project: `.result-table`, `#calc-status` and `#disclaimer` stay within 0,5 px while busy and after the result. No `min-width` or `table-layout` change was needed.
9. The message-probe test navigates with `page.goto('./?msgprobe')`.
10. "Message task negligible" is worded as "measured and recorded". The measurement confirms it (median ≤ 0,10 ms).
11. The 01-14 'Rechenarbeit' median stayed > 0 between Tasks 2 and 4 (the Task 2 e2e run passed with `toBeGreaterThan(0)`). No ≥ 0 relaxation was used.
12. The re-entry e2e takes the `#timing` mutation records with `takeRecords()` after each of the two synchronous clicks. The result is 1 after the first click and **0** after the second, so the readouts are not reset to 'wird gemessen …' a second time.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3: blocking] medianOf/tailOf live in bench-cases.js and are re-exported by compute-protocol.js.**
- The client needs them. A static import of compute-protocol.js from the client would have pulled the engine into the main chunk, and the lazy fallback import would then be pointless.
- The `compute-protocol` exports from the plan's artifact list are kept.
- Commit 08a0c9f.

**2. [Rule 1: test bug] The RED bench-interleaving test expected `2 + BENCH_RUNS` sends.** The correct count is one compute job plus BENCH_RUNS bench runs. It was fixed in the GREEN commit 08a0c9f, and the commit message says so.

**3. [Rule 3] `busyCount` moved from Task 2 to Task 4.** The Task 2 increment was not read anywhere until the Task 4 readout, so `no-unused-vars` would have failed lint.

**4. [Rule 3] REQUIREMENTS.md: wording of the replaced target.**
- The plan's restated text ends with "replaces 'within one animation frame'". The acceptance check requires `grep -c "within one animation frame"` = 0, so it now reads "replaces the earlier one-frame recompute target".
- The quotes were re-checked on 2026-11-06 and are unchanged. The RAIL page only uses `&nbsp;` between number and unit.

**5. [Rule 3] Message-probe test settles the first page before `goto('./?msgprobe')`.** Without that, the first page's worker request was reported as `net::ERR_ABORTED` and failed the shared afterEach "failed requests" check.

**6. [Rule 2] Two client details the plan did not spell out, both unit-tested:**
- a failed eye is retried on the next request even with the same spec, which matches the German text "Bitte einen Wert erneut ändern";
- an answer that misses a current eye re-sends that eye.

**7. [Rule 3] Perf extreme run reads the maxima after every edit.** The ring holds 10 frames, and one `pressSequentially` edit is up to 6 frames, so reading only at the end would have dropped frames from (a)/(b).

**8. Acceptance-grep follow-up (316163b).** The three `boundingBox()` calls in Test 5 were written out explicitly, so the `boundingBox` ≥ 3 criterion is met without changing behaviour.

**9. A throwing Worker constructor goes through `client.workerError()`, which calls `onFallback('start')` because READY has not arrived.** The page does not call onFallback directly, so there is one fallback path.

**10. Extra test (orchestrator MINOR-4):** worker.spec.js has 9 tests, not 8. The extra one is the isolated `isCurrent` test.

### CLAUDE.md adjustments

None needed:
- the engine (`src/engine/`) is unchanged (`git diff --stat 9422edd..HEAD -- src/engine` is empty);
- the worker loads only the bundled same-origin module;
- every visible string comes from de-AT.js, and the tech.* no-digit check exits 0.

## Gates

- `npm run lint`: exit 0.
- `npm run test:coverage`: 26 files, 1070 tests passed. Engine coverage: 98,45 % statements, 96,38 % branches, 99,17 % lines.
- `npx vitest run src/state`: 109 tests (51 new).
- `npm run build`: ok. `npm run test:e2e`: **68 passed** (desktop + mobile: 25 smoke tests and 9 worker tests per project). `npm run test:e2e | grep -c perf-throttled` = 0.
- Task greps:
  - Worker construction: 1. `import('../state/compute-protocol.js')`: 1. Static compute-protocol import: 0. `evaluatePair(|memoLast`: 0. `isCurrent(`: 1. `data-pending`/`dataset.pending`: 2.
  - italic: unchanged (0). New aria-live: 0. `settled(page)`: 28 in smoke.spec.js, 13 in worker.spec.js, 6 in perf-throttled.spec.js. `test.fixme`: 0. innerHTML in src/ui: 0. `format: 'es'`: 1. Worker file: 8 lines.
  - worker.spec.js: `result-od-ct` 0, `not.toBe` 7, `boundingBox` 3; `contentType: 'text/javascript'` across worker.spec.js and helpers.js: 3.
  - Timing ids in index.html: 4. `aria-disabled` in main.js: 3. `isBenchRunning`: 1. `durationThreshold: 16`: 1. 'langsamster gemessener Fall': 0.
  - perf-throttled.spec.js: `__src|attachToTarget` 0, `result-od-ct` 0, `timing-rescan` 2.
  - REQUIREMENTS.md: 'within one animation frame' 0, rail 1, inp 1, 'rechnet …' 1, 'decided on the real phone' 1, `| ENG-09 | Phase 1 | Pending |` 1.

## Requirements

- None marked complete. **ENG-09 stays Pending.** It is restated, the 4× proxy fails (a) (measured), and (c)/(d) need the real phone (01-11).

## Known Stubs

None. `#timing-result` stays empty until the first input-driven result, and `#timing-busy` shows '–' as the longest wait until then. Both are deliberate: the start-up result is not an input.

## Threat Flags

None beyond the plan's threat model.
- T-01-38: unit seq test plus the e2e discrimination runs A and B.
- T-01-39: exact CSP, zero violations, worker file under /assets/.
- T-01-40: one job in flight, bench guard, watchdog.
- T-01-41: English text goes to console.warn only.
- T-01-42: the measured and estimated labels are in the JSON, the table and every verdict line.
- The `?msgprobe` array exists only with that query.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | 6c34fdc | test(01-15): failing tests for worker protocol and compute client |
| 1 GREEN | 08a0c9f | feat(01-15): worker protocol, latest-wins compute client, one-run bench jobs, watchdog, rescan bench case |
| 2 | 9520d9a | feat(01-15): engine in a module Web Worker, settled signal, per-eye rechnet … state, fallback; smoke suite waits on settled |
| 3 | 71bf0d9 | test(01-15): worker e2e with slow-worker fixture, layout, axe and discrimination run |
| 3 follow-up | 316163b | test(01-15): name the three layout boxes explicitly in the busy-state test |
| 4 | 6b01189 | feat(01-15): main-thread timing including paint, one-run worker bench with guard, busy counter, Event Timing |
| 5 test | 8358f2e | test(01-15): throttled proxy measures main-thread criteria, estimates worker criteria |
| 5 docs | 8c467e2 | docs(01-15): restate ENG-09 to RAIL/INP (user decision Worker + RAIL target) |
| 6 | — | decision checkpoint: phone-decides (user, 2026-11-06) |

## TDD Gate Compliance

`test(01-15)` 6c34fdc precedes `feat(01-15)` 08a0c9f. The RED run failed because the modules were missing, plus 3 failing bench-cases tests.

## Self-Check: PASSED

All 7 created files exist. Commits 6c34fdc, 08a0c9f, 9520d9a, 71bf0d9, 316163b, 6b01189, 8358f2e and 8c467e2 are in `git log`.
