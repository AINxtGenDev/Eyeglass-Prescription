---
phase: 01-verified-engine-live-pipeline
plan: 04
subsystem: ci, deploy
tags: [github-actions, pages, sha-pin, eslint-boundary, gating, depl-02, depl-03, depl-04]
requires:
  - 01-01 package.json scripts, eslint.config.js boundary, vite app-commit meta, playwright BASE_URL switch
  - 01-03 page with smoke contract GREEN
provides:
  - .github/workflows/deploy.yml (build -> deploy -> verify-live, SHA-pinned, not yet pushed)
  - src/engine/boundary.test.js (ESLint-API negative + positive probes for engine, UI, state)
  - test/ci/pins.test.js (action SHA table, exact npm pins, lockfile v3, save-exact)
  - test/ci/workflow-structure.test.js (needs chain, gate order, no bypass, least privilege, triggers)
affects: [01-05]
tech-stack:
  added: []
  patterns:
    - workflow written in block-style YAML so a text slicer (no YAML library) can test it
    - verify-live waits for <meta name="app-commit" content="<sha7>"> on the live page
key-files:
  created:
    - .github/workflows/deploy.yml
    - src/engine/boundary.test.js
    - test/ci/pins.test.js
    - test/ci/workflow-structure.test.js
  modified: []
decisions:
  - "Only DEPL-04 marked complete. DEPL-02 and DEPL-03 say 'every push runs...' and 'enforced in CI'; the workflow has never run on GitHub, so both wait for the first CI run in 01-05. DEPL-01 needs the live site"
  - "Bypass ban (continue-on-error, always(), failure(), cancelled(), || true) applies to the whole file, not only build; the pipe ban applies to build run lines only, because verify-live's wait loop needs curl | grep inside an if"
  - "verify-live gets CI: true too, so the live smoke run also has forbidOnly"
metrics:
  duration: 3min
  completed: 2026-11-06
  tasks: 2
  files: 4
---

# Phase 1 Plan 04: Gated, SHA-Pinned CI/Pages Workflow Summary

The repo now has `.github/workflows/deploy.yml`, a single `build` job running lint, tests with coverage, build and the Playwright smoke test, followed by `deploy` (`needs: build`, main only, sole holder of `pages: write` / `id-token: write`) and `verify-live` (`needs: deploy`). All five actions are pinned to verified 40-character SHAs. Three unit-test files enforce the pins, the workflow structure and the engine lint boundary, and they run inside the `build` job. Nothing was pushed: the branch is `ahead 35` of `origin/main` after the task commits.

## Watch first

- **The workflow has never run on GitHub.** Everything below is local and static evidence. The behavioural DEPL-02 proof (a failing check leaves `build` red and `deploy` skipped) and the first real run belong to 01-05, after the user approves the push.
- **Pages must be enabled before the first push** (RESEARCH "Pages enablement order"). Otherwise `configure-pages` / `deploy-pages` fail on run 1. That is recoverable with a re-run, but noisy.
- `actionlint` is not installed here, so the workflow was not checked by a GitHub-semantics linter. It was parsed with PyYAML (structure printed below) and checked by the structure tests only.

## Tasks

| Task | Name | Commit | Key files |
|------|------|--------|-----------|
| 1 | Gate tests: engine boundary, pins, workflow structure (RED) | 47dfca4 | src/engine/boundary.test.js, test/ci/pins.test.js, test/ci/workflow-structure.test.js |
| 2 | SHA-pinned build -> deploy -> verify-live workflow (GREEN) | 06f9eaa | .github/workflows/deploy.yml |

## Verification evidence

**RED (before deploy.yml existed):**
- `npx vitest run src/engine/boundary.test.js`: 1 file, **15 passed**. That is 8 engine rejections (three, three/addons, `../ui/main.js`, document, window, fetch, performance, HTMLElement), the pure-function positive control, 3 UI sink rejections (innerHTML, outerHTML, insertAdjacentHTML), 2 UI positive controls (textContent, `document.title`) and 1 state `no-undef`.
- `npx vitest run test/ci`: **exit 1**, 14 failed / 4 passed. The 4 passes are the npm-pin tests, which need no workflow. The 14 failures included "at least one workflow exists", "workflow file exists", "job build exists" and the rest of the structure tests.

**GREEN:**
- `npx vitest run test/ci src/engine/boundary.test.js`: 3 files, **33 passed**, exit 0.
- `npm run lint`: exit 0.
- `npm run test:coverage`: 17 files, **189 passed**, exit 0. Engine coverage is unchanged at 97.75 % lines and 96.93 % branches.
- Grep acceptance: 7 `uses:` lines, 7 pinned as `@<40 hex> # v`; `continue-on-error` 0; `pages: write` 1.
- PyYAML parse: `on` = push [main], pull_request, workflow_dispatch; top-level permissions `{contents: read}`; deploy `needs: build`, `if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'`, permissions `{pages: write, id-token: write}`; verify-live `needs: deploy`; build and verify-live have no job-level permissions.
- `git status -sb`: `main...origin/main [ahead 35]` after both task commits. Nothing was pushed, and Pages was not touched.

**Mutation check.** Each mutation was applied to a scratch-backed copy, the tests were run, and the file was restored. The restored file was compared with `cmp` and passed again. Each of these mutations made `npx vitest run test/ci` exit 1:
- `continue-on-error: true` added to the lint step
- `if: always()` added to deploy
- `npm run test:coverage | tail -5`
- the configure-pages SHA replaced with the tag `v6`
- top-level `contents: write`

## Deviations from Plan

**1. [Rule 2 - Coverage of the threat model] More probes than the plan's behaviour list.** The plan listed 12 cases. I added `window.innerWidth` (engine) and `outerHTML` / `insertAdjacentHTML` (UI), because the eslint config bans all three and T-01-05 / T-01-15 cover them. That makes 15 cases. Commit 47dfca4.

**2. [Rule 2 - Gate bypass] Bypass strings are banned across the whole file.** The plan's wording could be read as limiting the ban to the build job. Banning `continue-on-error`, `always()`, `failure()`, `cancelled()` and `|| true` everywhere is strictly stronger. Only the pipe ban is limited to build `run:` lines, as specified. Commit 47dfca4.

**3. [Rule 2] The deploy `if:` must not contain `||`.** A disjunction could reopen a fork or PR path to deploy (T-01-16). Commit 47dfca4.

None of these changed the plan's files or scope.

## Requirements

| Requirement | Status | Why |
|---|---|---|
| DEPL-04 | **complete** | All 7 `uses:` are SHA-pinned to the verified table; npm deps are exact; lockfile v3; `save-exact=true`. All enforced by pins.test.js |
| DEPL-03 | pending | The lint rule and its negative test exist and are wired into the `build` job, but "enforced in CI" is only true once CI has actually run (01-05) |
| DEPL-02 | pending | Structural proof is done. The full text says every push runs the gates, which needs the first real run and the behavioural failing-check evidence (01-05) |
| DEPL-01 | pending | Site not deployed |

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. T-01-02 (SHA pins plus table test), T-01-03 (pages/id-token only on deploy), T-01-14 (no bypass, unpiped build steps, `needs` chain), T-01-15 (boundary test), T-01-16 (deploy `if` main and not PR, uploads skipped on PRs) and T-01-SC (`npm ci`, exact pins) are mitigated as planned.

## Self-Check: PASSED

- .github/workflows/deploy.yml, src/engine/boundary.test.js, test/ci/pins.test.js and test/ci/workflow-structure.test.js exist.
- Commits 47dfca4 and 06f9eaa are present in `git log`.
