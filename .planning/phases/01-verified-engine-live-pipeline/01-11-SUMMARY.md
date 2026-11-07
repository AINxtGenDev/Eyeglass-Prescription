---
phase: 01-verified-engine-live-pipeline
plan: 11
subsystem: release
tags: [phase-gate, lens-critic, final-push, verify-live, eng-09]
requires:
  - 01-01 … 01-10 (phase plans)
  - 01-12 … 01-15 (gap closure after the first NEEDS WORK)
provides:
  - Live site at commit 02bf4ff (https://ainxtgendev.github.io/Eyeglass-Prescription/)
affects: [phase-2]
decisions:
  - "First run of Task 1 (2026-11-06, HEAD e291946): lens-critic NEEDS WORK (3 MAJOR). User: \"Gap plan, then push\". Recorded in 01-VERIFICATION.md, then closed by 01-12 … 01-15."
  - "Re-run of Task 1 (2026-11-07, HEAD e8139c4): lens-critic VERDICT: PASS (0 BLOCKER, 0 MAJOR, 5 MINOR). MINORs 1, 3 and 4 were fixed before the push in 02bf4ff. MINORs 2 and 5 were accepted (see Open)."
  - "Task 2 (D-02 checkpoint 2): user's words 2026-11-06: \"please push it when finished\". The orchestrator confirmed this would apply only after a lens-critic PASS, or after the user explicitly accepted any open findings. That condition was met by the PASS. No findings needed accepting."
  - "ENG-09 marked complete on the real-phone measurement (2026-11-07), per the user's decision 'phone-decides'."
  - "DEPL-01 marked complete: on the live site, every request is under the sub-path and returns 200, there is no root favicon request and no console error (chrome-devtools, 2026-11-07)."
metrics:
  completed: 2026-11-07
---

# Phase 1 Plan 11: Phase Gate, Final Push and Live Verification

## Task 1 (re-run after the gaps): gate, trace, lens-critic

**Step 0 guards**
- `01-14-SUMMARY.md:59` contains `Decision (Task 4): web-worker`.
- `01-15-SUMMARY.md` contains the line `Proxy verdict (ENG-09 restated): 4× FAIL (a,b measured; c,d estimated)` and, at line 70, `Decision (Task 6): phone-decides`.
- Continued per the plan.

**Gate at HEAD e8139c4** (orchestrator, unpiped, exit 0)

| Check | Result |
|---|---|
| `npm ci` | ok |
| lint | ok |
| `test:coverage` | 1070/1070; 98,45 % lines / 96,38 % branches |
| `GITHUB_SHA=… build` | ok |
| `test:e2e` | 68/68 |

**Hygiene** (all 0 or empty):
- references tracked: 0
- dist containing references or .planning: empty
- `Stärke`: 0
- `innerHTML` in src/ui: 0
- non-test `from 'three'` in src/engine: 0

**Desktop bench** (Node, i7-8809G, informational)

| Case | Median | p95 | Evaluations per eye |
|---|---|---|---|
| Normal pair (−4/−2×30, rechteckig 52×38/18, PD 32) | 3,664 ms | 3,970 ms | 37 |
| Outline-cache miss | 4,278 ms | — | — |
| Grenzfall (+10,75 −1×89, 1,67, rechteckig 43×43/21, PD 36, FH 0) | 17,395 ms | 19,539 ms | 39 (228 iterations) |

**Requirement trace:** 21/21 rows ran ≥ 1 passing test with 0 failing, and there are no status mismatches. Full table: `/tmp/claude-1000/-home-nuc8-05-development-45-brille/beae44f8-9eba-48b3-b7a2-b56ed3dee3bf/scratchpad/01-11-trace2.md`.
- Open: DEPL-01 (live; now closed, see Task 3), DEPL-02 (structural only) and ENG-09 (phone).

**lens-critic result review: `VERDICT: PASS`.**

Confirmed in code, not just in the SUMMARYs:
- **GAP-1**, at `solve.js:176-179`:
  - 4000-eye fuzz: no convex back, and no D1 > maxD1.
  - Brute force from +0,50 to +14,00 in 0,05 steps: never thinner than the automatic choice.
  - The Zeiss tier 2 (d) test can fail: the pre-01-12 engine gives 6,722 mm against the 6,751 pin.
- **GAP-2:** after-paint timing, an outline-miss case, one canonical case, a per-eye memo and frame coalescing.
- **GAP-3:** sags (`evaluate.js:164-178`), abbe (`:197`), and the MAT-02 Expert-view clause moved to UX-02.
- **MINORs 1, 3, 5, 11, 12:** fixed.
- **Worker on the built site:** it runs under `/Eyeglass-Prescription/` with the CSP active and no errors.
- **+0,25 in 1,74 with no "damit wäre … dick" clause:** correct. There the Vogel lens is about 0,01 mm thinner than the chosen one, and the clause only appears when Vogel is at least 0,05 mm thicker.

Result-review MINORs:

| # | Finding | Resolution |
|---|---|---|
| 1 | Grenzfall label superlative was false | Fixed in 02bf4ff: "langsamster Fall unter den 1000 geprüften Zufallspaaren" |
| 2 | The Vogel comparison only gives a thickness when Vogel is thicker | Accepted. The worst observed gap is 0,0096 mm; revisit in phase 2 (Expert view) |
| 3 | Stale "always thinnest" comments | Fixed in 02bf4ff (solve.js, power.js, evaluate.js) |
| 4 | 01-12 pin-table cause mislabelled | Fixed in 02bf4ff |
| 5 | The raw Vogel value is not rounded to a usable step | Accepted (accurate as shown); phase 2 |

After the fixes: `npm test` 1070/1070, lint ok, smoke 50/50.

## Task 2: D-02 checkpoint 2

Push approved. The user wrote "please push it when finished" (2026-11-06); the stated condition was a lens-critic PASS, and the review returned PASS.

Manifest:
- 86 commits, `364dd91..02bf4ff`, as a fast-forward (`merge-base --is-ancestor` ok).
- 74 files changed, +14348/−335.
- Secret scan: no hits.
- references tracked: 0.

Rollback: `git revert <sha>` and push. Never force-push.

## Task 3: push and live verification

1. Pages: `build_type` = `workflow`.
2. `git push origin main` gave `364dd91..02bf4ff  main -> main`.
3. CI run `42348782420` (headSha `02bf4ffe…` = HEAD). `gh run watch --exit-status` exited 0. Jobs:
   ```
   {"conclusion":"success","name":"build"}
   {"conclusion":"success","name":"deploy"}
   {"conclusion":"success","name":"verify-live"}
   ```
4. Independent checks:
   - The curl grep for `content="02bf4ff"` printed 1.
   - `BASE_URL=https://ainxtgendev.github.io/Eyeglass-Prescription/ npx playwright test`: **68 passed**.
   - `git status -sb` shows `## main...origin/main`.
5. chrome-devtools on the live URL (390×844, mobile, touch, DPR 3):
   - **Requests and console:** 4 requests, all 200, all under `/Eyeglass-Prescription/` (document, JS, CSS, `engine.worker-BT7B2Ef6.js`). No `/favicon.ico` request and no console messages.
   - **Page state:** `data-mode="worker"`, `lang="de-AT"`, footer `02bf4ff`.
   - **R −4/−2×30:** CT 1,8 mm, max edge 7,3 mm (upper temple side), 8,5 g.
   - **L +4:** D1 +3,95 dpt, CT 4,9 mm, 8,8 g, shown with the τ wording and "Vogel +10,00 … 5,4 mm".
   - **+12 in rechteckig 62×55/24, PD 25:** CT 38,3 mm, D1 +9,19, with "Vogel +18,00 dpt, begrenzt auf +14,00 dpt; damit ließe sich das Glas in diesem Modell nicht berechnen". Diagnostic: "Großes Rohglas nötig … mindestens etwa 105,3 mm".
   - No `NaN` and no raw codes.
6. **ENG-09 real-device measurement (2026-11-07, user, Google Pixel, Chrome 156, UA "Mozilla/5.0 (Linux; Android 10; K) … Chrome/156.0.0.0 Mobile Safari/537.36"; live 02bf4ff, `data-mode` worker). Source: the user's screenshots of "Technische Angaben".**

   Bench readouts (worker), median / p95:

   | Case | Run 1 | Run 2 |
   |---|---|---|
   | Normal (−4/−2×30, rechteckig 52×38/18, PD 32) | 2,30 / 6,50 | 2,30 / 3,30 |
   | Outline miss | 2,20 / 3,50 | 2,10 / 3,20 |
   | Grenzfall | 9,95 / 11,70 | 9,70 / 9,90 |
   | Rescan pair | 25,40 / 25,60 | 25,30 / 25,50 |

   Run 1 covered case A with 10 slow edits **plus fast typing**, and 3× "Erneut messen". Results:
   - input to reaction: median 11,50 ms, longest 32,10 ms;
   - **main thread per input including rendering: median 7,40 ms, longest 30,10 ms**;
   - input to result visible (last 8): median 24,25 ms, longest 53,60 ms; result render longest 17,60 ms; compute median 7,20 ms;
   - "rechnet …": 2×, longest wait 53,60 ms;
   - Event Timing longest: 72 ms.

   Run 2 covered case A with **10 slow edits only, about 2 s apart**. Results:
   - input to reaction: median 10,65 ms, longest 15,80 ms;
   - **main thread per input including rendering: median 5,45 ms, longest 12,80 ms**;
   - input to result visible (last 10): median 24,35 ms, longest 27,30 ms; result render longest 4,70 ms; compute median 1,95 ms;
   - "rechnet …": 2× since load, longest 53,60 ms;
   - Event Timing longest: 64 ms.

   Verdict against restated ENG-09:

   | Criterion | Limit | Run 2 (slow edits) | Result |
   |---|---|---|---|
   | (a) every main-thread task incl. rendering | < 16,7 ms | longest 12,80 ms; result render 4,70 ms | PASS |
   | (b) INP | ≤ 200 ms | Event Timing max 64 ms (72 in run 1) | PASS |
   | (c) normal result visible, every edit | ≤ 100 ms | longest 27,30 ms (53,60 in run 1) | PASS |
   | (d) extreme cases | "rechnet …" shown, input responsive, result arrives | worker mode, "rechnet …" counted, longest wait 53,60 ms | PASS |

   **ENG-09 marked complete.**

   Recorded finding: during **fast typing** (run 1), the page's main-thread figure reached 30,10 ms and the result render 17,60 ms. The page timer spans from frame start to after-paint. When keystrokes arrive back to back, it can include several tasks; the 01-15 desktop diagnosis showed this (LoAF found no frame over 50 ms, and paced typing removed the inflation). On the phone the two cannot be separated, because LoAF is not readable there. The browser's own Event Timing stayed at ≤ 72 ms.

   Still to be supplied by the user: the exact Pixel model (the reduced UA hides it) and a subjective typing impression. Neither blocks the verdict, which rests on the readouts.

## Open

- **ENG-09:** passed on a real Pixel (see Task 3 step 6). Fast-typing residual (30,10 ms page figure) recorded as a finding; the phone model and typing impression are still to be supplied.
- **DEPL-02:** closed by a real CI demo (see "DEPL-02 CI gate demo" below).
- **Deferred:**
  - pilot orientation (assumed);
  - range checks (RX-04, phase 2);
  - the manual base-curve range and its convexity (MAT-03, phase 2);
  - minus lenses at the +0,50 floor (user-accepted, MAT-03);
  - result-review MINORs 2 and 5 (phase 2).

## DEPL-02 CI gate demo (2026-11-07, user-approved: "Run the CI demo (Recommended)")

- Branch `ci/gate-demo` was created from `main` at bb1ea0f. Commit a9e2b6d adds `test/ci/gate-demo.test.js`, which runs `expect(1).toBe(2)`.
- The branch was pushed, and the workflow was started with `gh workflow run deploy.yml --ref ci/gate-demo`. Run 42350539302 (event workflow_dispatch, headSha a9e2b6d) concluded with **failure**:
  ```
  {"conclusion":"failure","name":"build"}
  {"conclusion":"skipped","name":"verify-live"}
  {"conclusion":"skipped","name":"deploy"}
  ```
  Build steps: npm ci and lint succeeded. `npm run test:coverage` failed with `FAIL test/ci/gate-demo.test.js > DEPL-02 gate demo … AssertionError: expected 1 to be 2`. build, playwright install, test:e2e, configure-pages and upload-pages-artifact were all skipped, so no artifact was produced.
- Caveat, as planned in 01-05: on a non-main ref the deploy job is also excluded by its own `if:`. The demo therefore proves that a failing unit test turns build red in CI and that nothing is uploaded or deployed. The claim that build failure is what blocks deploy on main rests on `needs: build` (GitHub docs) plus `test/ci/workflow-structure.test.js`.
- Cleanup: `git push origin --delete ci/gate-demo`, the local branch was deleted, `git ls-remote origin ci/gate-demo` is empty, and `git log main | grep -c gate-demo` gives 0. The live site still serves 02bf4ff.
- **DEPL-02 marked complete.**

## Phase 1 requirement status

All 21 phase-1 requirements are complete: DEPL-01..04, ENG-01..09, MAT-01, MAT-02, RX-02, RX-03, FRAME-01, L10N-01, L10N-02, RES-06.

## Self-Check: PASSED
