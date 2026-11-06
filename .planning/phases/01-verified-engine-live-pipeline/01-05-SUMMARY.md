---
phase: 01-verified-engine-live-pipeline
plan: 05
subsystem: deploy
tags: [github-pages, first-push, verify-live, depl-01, depl-02, depl-03]
requires:
  - 01-03 page with smoke contract GREEN
  - 01-04 .github/workflows/deploy.yml and gate tests
provides:
  - Public site https://ainxtgendev.github.io/Eyeglass-Prescription/ (commit 364dd91)
  - GitHub Pages enabled, build_type workflow
affects: [01-06, 01-11]
key-files:
  created: []
  modified: []
decisions:
  - "D-02 checkpoint 1 answered by the user, who wrote \"please push it when finished\" (2026-11-06, during execute-phase). The orchestrator took this as push-main. It did not run the ci/gate-demo branch, because the user did not ask for those extra outward actions. DEPL-02's claim that a failure blocks the deploy therefore rests on `needs` plus the workflow-structure unit test, not on a CI demo."
  - "DEPL-03 marked complete: `npm run lint` (which carries the engine boundary rule) and boundary.test.js ran and passed in CI run 42211366016."
  - "DEPL-01 stays pending. Every page asset resolves under the sub-path, but the browser's automatic /favicon.ico request (at the origin root) returns 404 and logs a console error. Plan 01-06 adds the fix (an inline icon link), and DEPL-01 is closed after the next deploy."
metrics:
  duration: 10min
  completed: 2026-11-06
  tasks: 3
  files: 0
---

# Phase 1 Plan 05: Publish the Walking Skeleton

The skeleton is live at https://ainxtgendev.github.io/Eyeglass-Prescription/ on commit `364dd91`. Plan 01-05 was executed inline by the orchestrator.

## Task 1: Pre-push gate (local)

| Check | Result |
|---|---|
| `npm ci` | ok |
| `npm run lint` | exit 0 |
| `npm run test:coverage` | 189/189 tests; engine 97.75 % lines / 96.93 % branches |
| `GITHUB_SHA=… npm run build` | ok; `dist/index.html` contains the 7-char commit meta (count 1) |
| `npm run test:e2e` | 14/14 (desktop + mobile) |
| Build hygiene | `find dist` for references/.planning/*.md is empty; `git ls-files references` is 0 |
| `actionlint` 1.7.12 (Docker `rhysd/actionlint`, includes shellcheck) | exit 0, no findings. This closes 01-04's "not checked by actionlint" item |
| Fast-forward | `git merge-base --is-ancestor origin/main main` is ok |
| Secret scan of diff | no hits |

Pre-change remote state (for rollback): `{"has_pages":false,"default_branch":"main","visibility":"public"}`; `GET …/pages` returned 404.
Push manifest: 36 commits `6ce10a8..364dd91`, 70 files, +9691/−25 (47 files outside `.planning/`).

## Task 2: D-02 checkpoint 1

User's words, verbatim: "please push it when finished" → **push-main**.

## Task 3: Enable Pages, push, verify

1. `gh api -X POST repos/AINxtGenDev/Eyeglass-Prescription/pages -f build_type=workflow` returned `{"build_type":"workflow","html_url":"https://ainxtgendev.github.io/Eyeglass-Prescription/"}`.
2. `git push origin main`: `6ce10a8..364dd91  main -> main`, fast-forward.
3. CI run `42211366016` (headSha `364dd912…` = HEAD). `gh run watch --exit-status` exited 0. Jobs:
   ```
   {"conclusion":"success","name":"build"}
   {"conclusion":"success","name":"deploy"}
   {"conclusion":"success","name":"verify-live"}
   ```
   Every build step succeeded, in this order: npm ci, lint, test:coverage, build, playwright install, test:e2e, configure-pages, upload-pages-artifact.
4. Independent check from this machine: the curl grep for `content="364dd91"` printed `1`. `BASE_URL=https://ainxtgendev.github.io/Eyeglass-Prescription/ npm run test:e2e` passed 14/14. `git status -sb` shows `## main...origin/main`, with nothing ahead.

### chrome-devtools live check (390×844, mobile, touch, DPR 3)

- `lang=de-AT`, footer commit `364dd91`.
- Input −3,75 / −3,25 gives R: CT 1,8 mm, max edge 4,6 mm (temple side), min edge 3,8 mm (nasal), 7,8 g; L: max edge 4,2 mm, 7,4 g. No `NaN`.
- Timing readout: "Median 0,90 ms, p95 2,10 ms (50 Läufe)". That is desktop CPU with mobile emulation, not a phone measurement.
- Requests: the document, the JS and the CSS all return 200 under `/Eyeglass-Prescription/`. **`https://ainxtgendev.github.io/favicon.ico` returns 404**: the browser requests it automatically at the origin root, and it is the only console error. The Playwright smoke does not see it, because headless Chromium makes no favicon request. The fix is scheduled for 01-06.

## Rollback

- Turn Pages off: `gh api -X DELETE repos/AINxtGenDev/Eyeglass-Prescription/pages`
- Code: `git revert <sha>` then push (never force-push).

## Open

- Human check (end-of-phase, not blocking): open the live URL on a real phone and note the model, the browser and the timing median under "Technische Angaben". This is an early ENG-09 data point; the binding measurement is in 01-11.
- DEPL-02 behavioural demo was not run (see decisions).

## Self-Check: PASSED
