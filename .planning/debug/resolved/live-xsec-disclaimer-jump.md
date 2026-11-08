---
status: resolved
trigger: "verify-live job of run 42413430314 (live Pages, 66a9a68): [desktop] e2e/layout.spec.js:199 '1280 × 800, Experten-Ansicht on › the arriving cross-section does not move the disclaimer' expected 5231.59375 received 5279.59375 (+48 px); passed in build job against vite preview"
created: 2026-11-07
updated: 2026-11-08
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "layout.spec.js:199 reads 'before' between the #expert change event and the input-frame rAF that writes the Expert echo lines (+48 px desktop); the browser never paints that state"
  confirming_evidence:
    - "same-task measurement after click() = 5231.59375 every run, = CI 'before'; settled = 5279.59375 = CI 'after'"
    - "rAF trace: only the echo lines change (+24 +24) in the frame after the switch"
    - "one layout-shift entry per switch, also at 6x CPU: no painted intermediate state"
    - "deferred-rAF harness reproduces CI numbers 12/12 against live; settled() after check: 24/24 pass"
  falsification_test: "a second layout-shift entry after the switch, or the spec still failing with settled() under deferred rAF"
  fix_rationale: "the test's claim is about the painted layout while the drawing is pending; settled() waits for the input frame, the same gate every other spec uses after an input"
  blind_spots: "layout-shift sources list is capped at 5 nodes, so the evidence is 'no second rendered shift at all', not a disclaimer-specific entry; real phones (Safari/WebKit) not tested - rAF-before-paint is per HTML spec"
next_action: orchestrator pushes 976629f; confirm verify-live green in CI, then archive

## Symptoms

expected: #disclaimer page top identical before and after the Querschnitt drawing arrives (desktop 1280x800, Experten-Ansicht on)
actual: live site: before 5231.59375, after 5279.59375 (+48 px); vite preview in CI build job: pass
errors: "disclaimer top (page px) after the drawing arrived" Expected 5231.59375 Received 5279.59375
reproduction: BASE_URL=https://ainxtgendev.github.io/Eyeglass-Prescription/ npx playwright test e2e/layout.spec.js --project=desktop -g "arriving cross-section"
started: first verify-live run after 66a9a68 (run 42413430314)

## Eliminated

- hypothesis: compare rows / material intro arriving late move the disclaimer
  evidence: compare delayed 1.5 s: #compare +210 px, #disclaimer unchanged (col-inputs is taller on desktop)
  timestamp: 2026-11-07
- hypothesis: late network asset/font on the live host
  evidence: live and preview steady state identical (5279.59 in DejaVu); trace shows the 48 px are text set by JS in the input frame
  timestamp: 2026-11-07

## Evidence

- timestamp: 2026-11-07
  checked: gh run view 42413430314 --log-failed
  found: only failure in verify-live: [desktop] layout.spec.js:199; 388 passed
  implication: only the 1280 desktop variant failed; mobile 360 variant passed live

- timestamp: 2026-11-07
  checked: spec + instrumented copy against live URL on host (Noto Sans), 3x4 + 5 runs
  found: all pass; disclaimer 5142.59 constant (host font differs from CI)
  implication: need CI font environment (DejaVu, see resolved ci-e2e-font-layout)
- timestamp: 2026-11-07
  checked: ubuntu:26.04 + playwright deps + fonts-dejavu-core container (image brille-ci-fonts:local) against live URL; spec 12 runs, diag 4 runs
  found: all pass; steady disclaimer top 5279.59375 = CI 'received' (after) value exactly; CI 'before' 5231.59 is 48 px less
  implication: steady state is correct; CI read 'before' in a transient state 48 px shorter
- timestamp: 2026-11-07
  checked: diag with compare lane delayed too (TYPES=profile,compare)
  found: #compare grows 210 px when compare arrives but #disclaimer top stays 5279.59 (col-inputs is the taller column)
  implication: compare rows are not the 48 px element (eliminated)
- timestamp: 2026-11-07
  checked: rAF-tick trace of all element heights from load, against live in DejaVu container (e2e/_diag-trace.spec.js, temporary)
  found: frame right after '#expert' change: top=5231.59, res=input, xs=profile. Next tick: top=5279.59; changes only col-inputs +48, glass-settings +48, expert-basecurve-echo 0->24, expert-min 88->112 (expert-min-ct-echo/-et-echo 0->24, same row), timing-input (below disclaimer)
  implication: the 48 px are the Expert field echo lines (#expert-basecurve-echo, #expert-min-*-echo) written by readExpertOverrides in the input frame (rAF), not by the switch handler; #xsec[data-pending=profile] is already set synchronously by the switch handler, so the test's 'before' gate is satisfied before the input frame ran

- timestamp: 2026-11-07
  checked: e2e/_diag-paint.spec.js (temporary) in DejaVu container, preview + live, CPU 1x and 6x, 1280 and 360: #disclaimer top measured in the same task as document.getElementById('expert').click(), plus PerformanceObserver layout-shift entries after the click
  found: same-task top = 5231.59375 (1280) every run = CI 'before'; settled 5279.59375 = CI 'after'; 360: +72 px (12687.47 -> 12759.47). Exactly one layout-shift entry per switch (at 11-16 ms, 65-112 ms at 6x CPU), never a second one for the echo lines
  implication: the 48 px state exists only in the task gap between the change event and the input-frame rAF; the input frame (plain requestAnimationFrame, src/state/frame-scheduler.js) runs before the next paint, so the intermediate layout is never painted and users see no jump
- timestamp: 2026-11-07
  checked: natural race: live spec x100 (8 workers) in container
  found: 100 passed
  implication: the CI failure is a rare timing race (Playwright's next evaluate landing before the next frame)
- timestamp: 2026-11-07
  checked: e2e/_diag-repro.spec.js (verbatim test body + init script deferring every rAF callback by SLOW_RAF ms = slow compositor) against live URL in DejaVu container
  found: SLOW_RAF=100: 12/12 failed, Expected 5231.59375 Received 5279.59375 (desktop), Expected 12687.46875 Received 12759.46875 (360); with FIXED=1 (settled() after check): SLOW_RAF=100 12/12 passed, SLOW_RAF=300 12/12 passed
  implication: CI failure reproduced deterministically with the exact CI numbers; waiting for the input frame fixes the measurement

## Resolution

root_cause: test timing, not an app layout shift. Turning on #expert synchronously unhides the Expert fields and sets #xsec[data-pending=profile]; the Expert echo lines (#expert-basecurve-echo, #expert-min-ct-echo / -et-echo, 2 rows x 24 px) are filled by the input frame, a requestAnimationFrame callback. The test's 'before' gate (#xsec pending) is already true in the task gap before that rAF, so on a slow frame the 'before' read (5231.59) saw a layout that the browser never paints; 'after' saw the real layout (5279.59).
fix: e2e/layout.spec.js:205 - await settled(page) after the switch (waits for the 'input' token to clear plus one frame), with written justification; assertion unchanged
verification: host: lint 0; vitest 34 files / 1595 tests, coverage pass; build ok; e2e 393 passed (389 + 4 temp repro). DejaVu container: real layout.spec.js preview x5 150 passed, LIVE x3 90 passed; repro unfixed SLOW_RAF=100 8/8 fail with CI numbers; repro fixed SLOW_RAF=200 + 150 ms request latency: preview 20/20, LIVE 20/20. Commit 976629f. Pending: verify-live job in the next CI run.
files_changed: [e2e/layout.spec.js]

## Resolution confirmed

2026-11-08: deploy run 42415734158 for 976629f passed build, deploy and verify-live (layout.spec:199 green on live Pages); live e2e re-run 389 passed / 1 skipped.
