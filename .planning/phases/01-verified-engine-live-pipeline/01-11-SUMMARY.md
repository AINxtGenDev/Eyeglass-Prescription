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
6. **ENG-09 real-device measurement: PENDING (user).** Needs the measurement on a real mid-range phone against the restated ENG-09 (a)–(d), per 01-11 Task 3 step 5.

## Open

- **ENG-09:** real-phone measurement (user). The proxy verdict was 4× FAIL (a,b measured; c,d estimated). Residual at 4×: plain edits take 14,5 ms median and 16,3 ms max, and frames reach 21–30 ms during unpaced typing. The user's decision was "phone-decides".
- **DEPL-02:** failure-blocks-deploy rests on structural evidence only (`needs:` plus workflow-structure.test.js). Accepted as MINOR-4.
- **Deferred:**
  - pilot orientation (assumed);
  - range checks (RX-04, phase 2);
  - the manual base-curve range and its convexity (MAT-03, phase 2);
  - minus lenses at the +0,50 floor (user-accepted, MAT-03);
  - result-review MINORs 2 and 5 (phase 2).
