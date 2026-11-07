---
phase: 02-lay-first-german-input-results-comparison
plan: 22
subsystem: perf proxy harness (ENG-09 (a) measurement)
tags: [ENG-09, lens-critic-M4, gap-closure, perf, harness]
requires: [02-21]
provides:
  - "PERF_METHOD=quiet (default) in e2e/perf-throttled.spec.js: no browser command between an input and its frame-end stamp; PERF_METHOD=legacy = the 02-14 / 02-20 method"
  - "Trace assertion: 0 DevToolsSession tasks inside every traced 4x case A / B input frame (quiet method)"
  - "verdict.ruleA in the perf JSON = the unchanged 02-20 rule; host.method / host.quietMs recorded"
affects: [e2e/perf-throttled.spec.js, .planning/REQUIREMENTS.md, .planning/phases/02-lay-first-german-input-results-comparison/02-VALIDATION.md]
tech-stack:
  added: []
  patterns:
    - "Measured input = selectText, one DevTools round trip to flush handle releases, 50 ms Node quiet, one Input.insertText, then a Node-side timer (no page call) before any read"
key-files:
  created:
    - .planning/phases/02-lay-first-german-input-results-comparison/02-22-SUMMARY.md
  modified:
    - e2e/perf-throttled.spec.js
    - .planning/REQUIREMENTS.md
    - .planning/phases/02-lay-first-german-input-results-comparison/02-VALIDATION.md
decisions:
  - "The quiet path uses locator.selectText() + page.keyboard.insertText() instead of fill(). This is fill's own sequence for a text input. fill() releases its element handle (Runtime.releaseObject) fire-and-forget after Input.insertText, and that release landed inside measured frames"
  - "A page.evaluate(() => 0) round trip plus 50 ms after selectText. The renderer processed one selectText release after the input (case B, 1 of 10 frames) even though it was sent first"
  - "QUIET_MS = 500: 02-20 untraced input to result painted was at most 61,2 ms at 4x and 99,5 ms at 6x"
  - "Verdict by the unchanged rule: 4x proxy part of (a) PASS in 3 of 3 runs. ENG-09 stays Pending until the 02-15 Task 3 real-phone check"
metrics:
  duration: "about 25 min (2026-11-07 20:38-21:13 UTC)"
  completed: 2026-11-07
  tasks: 2
  files: 3
---

# Phase 02 Plan 22: Quiet ENG-09 proxy measurement Summary

The 4× proxy now sends no DevTools command while an input frame is measured, and a trace shows that this removed only harness work. With this method, ENG-09 (a) passes on the 4× proxy in 3 of 3 runs, worst input frame 10,0 ms. The old method on the same build still fails (19,9 ms). **ENG-09 stays Pending:** the real-phone check in 02-15 Task 3 is still required, and lens-critic M4 has to be re-reviewed there.

**Watch first:**
- **The two methods space the edits differently.** The quiet method waits at least 550 ms between edits. The legacy method starts the next edit as soon as `settled()` returns, about 50–100 ms at 4×. So in the quiet runs the compare lane of one edit is done before the next edit, and in legacy runs it may not be. The measured window and the app code are identical in both methods. Discrete Rx edits with a pause between them are realistic, but this is a real difference and lens-critic should weigh it.
- **6× is not covered by the rule, and it is borderline.** In quiet run 2, case A max was 17,8 ms. The other runs gave 12,9 and 14,6 ms. The traced run gave 17,9 ms.
- **The extreme run is unchanged.** Its keystrokes are themselves DevTools commands. Its 4× input-frame max (56–62 ms) is still a multi-task window, as in 01-15 and 02-20.

## Task 1: Quiet window, proven by trace

**Playwright calls that could land between an input and its frame-end stamp (legacy method):**
1. `expect(#result).toHaveAttribute('data-pending', '')` in `settled()`. Its first poll runs right after `fill` returns, and it keeps polling until the result is painted.
2. `page.evaluate(rAF → setTimeout)` in `settled()`.
3. `fill()`'s own trailing `element3?.dispose()`. This is a fire-and-forget `Runtime.releaseObject` in a `finally` block, sent after `Input.insertText` (`node_modules/playwright-core/lib/coreBundle.js`, `_retryWithProgressIfNotConnected`). The plan did not list this one. The first quiet trace found it.
4. The reads after an edit (`readInput` / `readResult` locator `textContent`). In editRun they run only after the loop.
5. The next edit's `fill` (locator resolve, actionability `evaluateInUtility`).
6. CDP throttling calls. These are sent only before and after a rate, never inside the edit loop.

**Method.** `PERF_METHOD=quiet` is the default. Each edit runs these steps:
1. `locator.selectText()`. Injected `input.select(); input.focus()` runs outside the frame.
2. `page.evaluate(() => 0)`. Commands on one session are handled in order, so this flushes selectText's handle releases.
3. `sleep(50)` in Node.
4. `page.keyboard.insertText(value)`. This is one CDP `Input.insertText` and dispatches the input.
5. `sleep(QUIET_MS = 500)` in Node, with no browser command.
6. One `page.evaluate` that records whether `#result[data-pending]` was already '' (`quietSettled`).
7. `settled()`.

This is the same input path as `fill()`. For a text input, Playwright 1.65's `_fill` runs injected `fill` → `selectText(element)` → `'needsinput'` → `keyboard.insertText(value)` → `crInput.sendText` = `Input.insertText` (coreBundle.js, read 2026-11-07). The fields, values and events are the same. Only the handle release moves out of the frame.

`PERF_METHOD=legacy` runs `fill` + `settled()` exactly as before. The measured window (`runFrame` rAF start → after-paint timeout) and `src/` are unchanged. Nothing is subtracted.

**Iterations (trace files in the scratchpad):**
1. `fill` + quiet window, in `t22first/`. 4× case A had 248-byte DevToolsSession tasks in 3 of 10 frames (0,04–0,54 ms) and case B in 2 of 10. Each was `fill`'s release, 5–13 ms after its `Input.insertText`.
2. `selectText` + `insertText`, in `t22second/`. Case A had 0. Case B had 1 frame with one 248-byte task at +9,55 ms, which was selectText's release processed after the input.
3. With the flush round trip and 50 ms: **0 DevToolsSession tasks in 10 + 10 measured 4× frames**. The spec assertion `devtoolsTasksInFrame.max === 0` passed: `1 passed (2.1m)`, exit 0.

**Attribution: traced 4×, median / max ms.** The 02-20 column is the "before run1" trace (old method). The 02-22 columns are the quiet traced run (`trace-02-22-quiet.json`). All of these are traced and `?perfmarks` runs, so they are inflated and used only for attribution.

| Bucket | 02-20 case A (old) | 02-20 case B (old) | 02-22 case A (quiet) | 02-22 case B (quiet) |
|---|---|---|---|---|
| frame (window) | 21,3 / 22,8 | 20,85 / 23,3 | 10,4 / 14,2 | 9,45 / 13,7 |
| **DevToolsSession task in window** | 11,4 / 12,72 | 11,07 / 13,28 | **0 / 0** (0 tasks) | **0 / 0** (0 tasks) |
| input task (u:update, all JS) | 2,7 / 3,5 | 2,75 / 3,3 | 2,85 / 4,0 | 2,65 / 3,5 |
| – u:rm.startCompare | 0,35 / 0,9 | 0,3 / 1,0 | 0 / 0,9 | 0,3 / 0,9 |
| style | 0,04 / 0,7 | 0,02 / 0,26 | 0,02 / 0,81 | 0 / 0,77 |
| layout | 1,1 / 1,68 | 1,51 / 1,67 | 1,41 / 1,88 | 0,99 / 1,93 |
| paint (PrePaint+Paint+Layerize+Commit) | 5,27 / 7,12 | 6,84 / 7,61 | 6,81 / 9,88 | 5,98 / 10,62 |
| GC | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| forced style/layout in JS | – | – | 0,17 / 1,92 | 0,03 / 1,91 |
| other (busy − named buckets) | 11,63 / 15,75 | 11,08 / 12,01 | −0,21 / 1,67 | 0,19 / 1,37 |
| idle | – | – | 0,01 / 0,02 | 0,01 / 0,63 |
| old frame minus DevTools task | 9,98 / 10,81 | 10,16 / 11,04 | – | – |

- The quiet frame is about the same as the old "frame minus DevTools task". The app buckets (JS, style, layout, paint, GC) are in the same range in both methods. Paint max is higher in the quiet traced run (9,9–10,6 against 7,1–7,6), so app paint cost was not hidden.
- "other" fell from 11–16 ms to about 0, which is the removed DevTools task.
- No tasks were found inside u:update either, so the input frame is now app work only.

## Task 2: Re-measurement (untraced, same build)

Commands:
- `PERF_OUT=<scratchpad>/perf-02-22-quiet-run{1,2,3}.json npm run test:perf`. Each printed `1 passed (2.1m / 2.1m / 2.0m)`, exit 0.
- `PERF_METHOD=legacy PERF_OUT=<scratchpad>/perf-02-22-legacy-run1.json npm run test:perf`. It printed `1 passed (1.3m)`, exit 0.
- `uptime` load before each run: 2,31 / 2,17 / 1,34 / 1,12 on 8 cores.

In every quiet run, every edit had its result painted inside the 500 ms window (`quietSettled` 10/10 for case A and case B at every rate). So the result frames were quiet as well.

**4× (the rule rate), ms**

| Run | BI | Case A input median / max | Case B input median / max | compare start max A / B (min gap) | Result frame max A / B | Compare paint max | Rule (a) |
|---|---|---|---|---|---|---|---|
| quiet 1 | 438,5 | 6,7 / **7,4** | 6,85 / **9,1** | 0,8 / 0,8 (0,1) | 11,6 / 14,3 | 10,4 | **PASS** |
| quiet 2 | 481 | 6,6 / **10,0** | 7,4 / **8,4** | 0,9 / 0,8 (0,1) | 10,3 / 14,0 | 10,3 | **PASS** |
| quiet 3 | 451,5 | 6,95 / **8,4** | 6,9 / **7,6** | 0,7 / 1,0 (0,3) | 10,1 / 11,6 | 9,7 | **PASS** |
| legacy | 454 | 17,75 / **19,9** | 17,25 / **19,6** | 0,9 / 0,9 (0,1) | 15,4 / 12,8 | 13,7 | **FAIL** |
| (quiet, traced, attribution only) | 404 | 10,4 / 14,2 | 9,45 / 13,7 | 1,3 / 1,1 | 20,7 / 13,6 | 19,6 | (PASS) |

**Other rates (quiet runs 1 / 2 / 3; legacy), input frame max A / B, ms**

| Rate | quiet 1 | quiet 2 | quiet 3 | legacy |
|---|---|---|---|---|
| 1× | 2,0 / 2,0 | 2,5 / 1,9 | 2,4 / 2,5 | 2,3 / 4,5 |
| 2× | 4,3 / 4,0 | 4,9 / 4,0 | 4,4 / 4,2 | 11,6 / 11,0 |
| 6× | 12,9 / 12,9 | **17,8** / 11,5 | 14,6 / 10,6 | 32,3 / 33,6 |

Other 4× values for quiet runs 1 / 2 / 3, with legacy last:
- Extreme run input frame max: 58,8 / 56,1 / 62,4; legacy 63,2.
- (b) worst: 61,8 / 63,6 / 64,4 (≤ 200, pass); legacy 65,6.
- (c) estimate: 44,0 / 45,9 / 36,9 (≤ 100, pass); legacy 67,7. The (c) overhead term is the result latency, which also contained harness work under the old method.

**Verdict, with the 02-20 rule unchanged:** every 4× case A and B input frame and every deferred compare start must be < 16,7 ms in every run.
- Quiet runs 1 / 2 / 3: case A max 7,4 / 10,0 / 8,4, case B max 9,1 / 8,4 / 7,6, compare start max 0,8 / 0,9 / 1,0.
- **Result: proxy part of ENG-09 (a) PASS.** The legacy run reproduces the 02-20 FAIL.

**Records:**
- `.planning/REQUIREMENTS.md` ENG-09 has a dated 02-22 note with the user decision, the trace evidence, the numbers and the verdict. It is still `- [ ]` with traceability `Pending`. The "Last updated" line is updated.
- In `02-VALIDATION.md`, the ENG-09 (regression) row now has the method, both commands and the result.

## Deviations from Plan

**1. [Rule 1 - Bug] fill() is not quiet: its handle release lands in the frame**
- **Found during:** Task 1, first traced quiet run. The spec assertion failed: `4× caseA: DevToolsSession tasks in a measured frame`, expected 0, received 1.
- **Issue:** Playwright's `fill` sends `Runtime.releaseObject` fire-and-forget after `Input.insertText`.
- **Fix:** the quiet path calls fill's own two steps directly (`selectText`, then `keyboard.insertText`), with a flushing `page.evaluate(() => 0)` round trip and 50 ms in between. The input path is the same.
- **Files:** e2e/perf-throttled.spec.js.
- **Commit:** c04ce0b.

**2. e2e/helpers.js not changed.** The plan listed it, but every change fit in the perf spec.

**3. A `verdict.ruleA` field was added.** The existing `verdict.a` also counts the extreme run and the result and compare paint frames, so it always fails at 4× because of the extreme run. `ruleA` encodes the plan-level rule that 02-20 and this plan apply. `verdict.a` is unchanged.

## Plan-end suite (real output; logs in `<scratchpad>/s22/`)

- `npm run lint`: exit 0, `> eslint .`, no findings.
- `npm run test:coverage`: exit 0.
  - `Test Files  34 passed (34)`, `Tests  1595 passed (1595)`, `Duration  212.61s`.
  - All files 98.34 % statements, 96.52 % branches, 100 % functions, 99.15 % lines.
- `npm run build`: exit 0, `✓ 48 modules transformed.`, `✓ built in 151ms`.
- `npm run test:e2e`: exit 0, `1 skipped`, `389 passed (2.2m)`. The skip is the by-design `[mobile] rx.spec.js:316`.
- `npx prettier --check` warns on the spec. It already warned on the HEAD version, and the repo has no Prettier config. `prettier --write` was not run.

Nothing was pushed. `src/` and `.planning/config.json` are untouched. 02-15 is untouched.

## Raw files

All in `/tmp/claude-1000/-home-nuc8-05-development-45-brille/3ed767a8-1239-46ae-8f86-b2a6de7bb434/scratchpad/` (not committed):
- `trace-02-22-quiet.json` with `.4x-caseA/.4x-caseB/.1x-extreme.trace.json`, and `perf-02-22-quiet-traced.json`.
- `perf-02-22-quiet-run{1,2,3}.json` and `perf-02-22-legacy-run1.json`, plus their `.log` files.
- `t22first/` and `t22second/`: the two failing quiet-trace iterations.
- `dt22.cjs` and `dt22b.cjs`: the per-frame DevTools-task listings.

## Threat Flags

None. The change is harness-only. T-02-70 is mitigated: the window and the app code are unchanged, a trace shows that the removed work is DevToolsSession only, the legacy method is kept and was re-run, and the phone check is still required.

## Self-Check: PASSED

- e2e/perf-throttled.spec.js, .planning/REQUIREMENTS.md and 02-VALIDATION.md are modified and committed in c04ce0b and 271bfff. Both commits are present in `git log`.
- `PERF_METHOD`, `devtoolsTasksInFrame` and `ruleA` are in the spec.
- `- [ ] **ENG-09**` occurs once in REQUIREMENTS.md, and its traceability row says Pending.
