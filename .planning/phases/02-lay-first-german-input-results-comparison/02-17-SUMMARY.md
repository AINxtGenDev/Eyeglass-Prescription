---
phase: 02-lay-first-german-input-results-comparison
plan: 17
subsystem: Experten-Analyse cross-section + phone summary bar
tags: [ANA-01, RES-03, lens-critic-M1, lens-critic-M2, gap-closure]
requires: [02-16]
provides:
  - "Meridian picker powers from engine meridianPower D(θ) = S + C·sin²(θ − α); 0° is 'Hauptschnitt' only when 0 ≡ α or α + 90°, else 'kein Hauptschnitt ({power})'"
  - "Zyl 0 option 'waagrecht (0°), {power}' (amendment)"
  - "Summary bar label prefix 'Vorher (A):' while the cards show A; results.js setCardConfig(config), set by pipeline.js paintCards"
affects: [src/ui/cross-section.js, src/ui/summary-bar.js, src/ui/results.js, src/ui/pipeline.js, src/i18n/de-AT.js, src/i18n/dictionary.test.js, e2e/xsec.spec.js, e2e/compare.spec.js, 02-UI-SPEC.md]
tech-stack:
  added: []
  patterns:
    - "UI labels that show a power call the engine function (meridianPower) instead of re-deriving it"
    - "Bar prefix comes from the same showA state that sets the card suffix (paintCards → setCardConfig)"
key-files:
  created: []
  modified:
    - src/ui/cross-section.js
    - src/ui/summary-bar.js
    - src/ui/results.js
    - src/ui/pipeline.js
    - src/i18n/de-AT.js
    - src/i18n/dictionary.test.js
    - e2e/xsec.spec.js
    - e2e/compare.spec.js
    - .planning/phases/02-lay-first-german-input-results-comparison/02-UI-SPEC.md
decisions:
  - "M2: mark the bar with 'Vorher (A):' instead of auto-switching the toggle to Nachher on an edit; changing the user's radio without their action would be a surprising context change (WCAG 3.2.2 spirit) and would hide the A values they chose to see"
  - "Zyl 0 uses a separate key xs.meridian.hSphere ('waagrecht (0°), {power}'); xs.meridian.h stays for the no-Rx case"
  - "320 px bar gate asserts 'prefix adds no line, label one line, bar < 72 px scroll padding' instead of '≤ 56 px': the bar is 59.6 px tall with and without the prefix (pre-existing)"
metrics:
  duration: "~20 min"
  completed: 2026-11-07
  tasks: 2
---

# Phase 02 Plan 17: Meridian labels and Vorher bar marker (M1, M2) Summary

The meridian picker now takes every power from the engine's `meridianPower`. The oblique 0° section of the example left lens (−2,50 / −0,75 × 170) reads "waagrecht (0°), kein Hauptschnitt (−2,52 dpt)". It used to read a wrong −3,25 dpt labelled as a Hauptschnitt. On phones, the summary bar starts with "Vorher (A):" while the cards show A.

## Tasks

| Task | Commit | What |
| ---- | ------ | ---- |
| 1 RED | 7958640 | e2e option texts for axes 170, 45, 180, 90 and Zyl 0. Powers worked out by hand in comments. 170, 45 and Zyl 0 failed. 180 and 90 already passed, since 0° is principal there. |
| 1 GREEN | 705e047 | `renderMeridianOptions` uses `meridianPower`. Added `isPrincipal`. New keys `xs.meridian.hOblique` and `xs.meridian.hSphere`. Placeholder whitelist and UI-SPEC row updated. |
| 2 RED | d2cc153 | 360 px test: prefix shown through toggle, frame edit (Klein), Nachher, Vorher and end. Bar values equal the card strings. 320 px height test. All failed on the missing prefix. |
| 2 GREEN | f6dd551 | `bar.prefix.a`, `updateSummaryBar({ …, config })`, `setCardConfig` in results.js, called at the start of `paintCards`. 320 px gate adjusted (see deviations). UI-SPEC summary-bar line updated. |

## Deviations from Plan

**1. [Rule 3 - Blocking] dictionary.test.js placeholder whitelist**
- **Found during:** Task 1
- **Issue:** The `xs.*` placeholder whitelist test would fail for the two new keys with `{power}`. The file was not in the task's files list.
- **Fix:** Added `xs.meridian.hOblique` and `xs.meridian.hSphere: ['power']` to the whitelist.
- **Commit:** 705e047

**2. [Rule 1 - Test premise] 320 px bar gate (amendment m-g)**
- **Found during:** Task 2
- **Issue:** The amendment asked for "bar ≤ 56 px". The measured bar is 59.6 px both with and without the prefix: 8 px padding + 19.6 px label + 24 px values + 8 px padding. The 56 px is only the CSS `min-height`, so the gate failed for a reason that was already there before this plan, not because of the prefix. The prefix does not wrap.
- **Fix:** The test now checks the amendment's intent directly. Height with the prefix = height without it (±1 px). The label fits on one line (≤ 20.6 px). The bar is < 72 px (`scroll-padding-bottom`). The prefix text stays "Vorher (A):", since it does not wrap.
- **Note for lens-critic:** the style.css comment "72 px = 56 px bar + 16 px" is inaccurate. The real margin is 72 − 59.6 = 12.4 px, so WCAG 2.4.11 still holds (the existing layout test "focused field … not covered" passes). The comment was not changed because it is out of scope.
- **Commit:** f6dd551

## Verification

Full suite at plan end, `npm run lint && npm run test:coverage && npm run build && npm run test:e2e`, exit 0:
- lint: clean
- test:coverage: 34 files, 1573 tests passed; All files 98.34 % stmts / 96.52 % branch / 100 % funcs / 99.15 % lines
- build: built in 143 ms
- test:e2e: 354 passed (2.2 min), desktop + mobile projects

Acceptance greps: `meridianPower` in cross-section.js = 3, `rx.sph + rx.cyl` = 0, `'xs.meridian.hOblique'` = 1, `−2,52 dpt` in xsec.spec = 1; `'bar.prefix.a'` = 1, `bar.prefix.a` in summary-bar.js = 1, non-comment `aria-label` in summary-bar.js = 0, `export function setCardConfig` = 1, `setCardConfig(` in pipeline.js = 1.

## Self-Check: PASSED

## Threat Flags

None. New strings are written through `setText`/`textContent` only.

## Known Stubs

None.
