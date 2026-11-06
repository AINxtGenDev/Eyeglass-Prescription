---
phase: 01-verified-engine-live-pipeline
plan: 09
subsystem: state-ui
tags: [cylinder, transposition, rx-02, rx-03, l10n]
requires:
  - 01-08 toric back surface (evaluateLens accepts cyl <= 0)
  - 01-01 parseAxis / fmtAxis
provides:
  - "src/state/transpose.js: transpose({sph,cyl,axisDeg}) -> {minus, plus|null, transposed}, RX_CODES"
  - "Zyl/Achse columns per eye (#rx-{od,os}-{cyl,axis}) with echo, error and #rx-{od,os}-forms"
  - "UI sends only the minus-cylinder form to the engine"
affects: [01-10, 01-11, phase-2 RX-04 range checks]
tech-stack:
  added: []
  patterns:
    - "State tier returns codes; the UI maps them to German text through t('rx.' + code)"
    - "showFieldOk / showFieldError helpers shared by every input field"
key-files:
  created:
    - src/state/transpose.js
    - src/state/transpose.test.js
  modified:
    - index.html
    - src/ui/main.js
    - src/ui/style.css
    - src/i18n/de-AT.js
    - src/i18n/dictionary.test.js
    - e2e/smoke.spec.js
decisions:
  - "[01-09]: Blank Zyl = 0. Achse is required only when Zyl is not 0, and it is never defaulted. A non-blank Achse is always parsed, so an invalid Achse blocks the eye even when Zyl is 0 (no silent drop)."
  - "[01-09]: RX-02 and RX-03 marked complete (the axis field with ° now exists on the page). L10N-01 stays pending: diagnostic texts still show raw codes until 01-10."
metrics:
  duration: 4min
  completed: 2026-11-06
  tasks: 2
  files: 8
---

# Phase 01 Plan 09: Zyl/Achse Input and Cylinder Transposition Summary

The page now accepts a full Sph / Zyl / Achse paper Rx for each eye, in either cylinder form. A plus-cylinder entry is transposed by the pure `transpose()` before the LensSpec is built, and both forms are shown in German. The engine only ever receives the minus form, so the results come from the 01-08 torus.

## What the page shows (built page, 360 px viewport, checked with a scratch Playwright script)

| Input | `#rx-*-forms` text | CT | ET max | ET min | Weight |
|---|---|---|---|---|---|
| R +1,00 / +2,00 × 90 | "Ihr Pluszylinder wurde in die Minuszylinder-Schreibweise umgerechnet. R – rechtes Auge: Minuszylinder: +3,00 dpt / −2,00 dpt × 180° · Pluszylinder: +1,00 dpt / +2,00 dpt × 90°" | 3,6 mm | 3,2 mm – oben | 1,0 mm – schläfenseitig | 7,0 g |
| L −2,00 / −1,00 × 180 | "L – linkes Auge: Minuszylinder: −2,00 dpt / −1,00 dpt × 180° · Pluszylinder: −3,00 dpt / +1,00 dpt × 90°" | 1,8 mm | 4,0 mm – oben, schläfenseitig | 2,9 mm – nasal | 6,4 g |

- **Plausibility:** for +3 −2 × 180 the horizontal meridian is +3 dpt and the vertical one +1 dpt, so a plus lens with the thinnest edge horizontal and the thickest at the top matches the optics.
- **Layout:** with 5 Rx columns, `scrollWidth` is 360 at a 360 px width, so nothing scrolls sideways.
- **Accessibility:** axe reports no violations with both forms visible.

## Verification

- `npx vitest run src/state/transpose.test.js`: 7 tests pass. One of them is the round-trip property (numRuns 200, seed 5, quarter steps, axes in [0, 180), spherical equivalent invariant).
- `npm run lint`: exit 0.
- `npx vitest run --coverage`: 760 tests pass; All files 97.38 % lines.
- `npm run build && npm run test:e2e`: 22/22 pass on desktop and mobile, including "plus cylinder shows both forms" and "cylinder without axis".
- Acceptance greps:
  - `id="rx-(od|os)-(cyl|axis)"` = 4.
  - Non-comment `transpose(` in main.js = 1.
  - "Stärke" in de-AT.js = 0.
  - No `innerHTML` in main.js.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 RED | 636fa62 | test(01-09): add failing tests for plus/minus cylinder transposition |
| 1 GREEN | adb41d0 | feat(01-09): plus/minus cylinder transposition with both forms |
| 2 | d2b72aa | feat(01-09): Zyl/Achse input per eye with both cylinder forms |

## Deviations from Plan

### Additions (Rule 2)

**1. More dictionary keys than the plan listed.** These follow the existing Sph pattern:
- `rx.cyl.title` and `rx.axis.title` (abbr tooltips, wording from the PITFALLS de-AT table)
- `rx.axis.unit`
- per-eye visually-hidden labels `rx.{od,os}.{cyl,axis}.label`

`rx.cyl.label` and `rx.axis.label` are hint paragraphs below the table, like `rx.sph.label`.

**2. Dictionary test now checks for `rx.<code>`.** `dictionary.test.js` asserts an `rx.<code>` key exists for every `RX_CODES` entry, matching the existing check for PARSE_CODES.

**3. Small CSS change.** Narrower inline padding in `.rx-table` keeps 5 columns inside 360 px. `.rx-forms` gets a left border, so the forms box is set apart by its border as well as its colour.

**4. Extra checks in the smoke tests.** "plus cylinder shows both forms" also checks for "umgerechnet" and an empty status cell. "cylinder without axis" also checks that the OD CT cell shows "–", which proves no compute ran.

### Refactor inside the task

- `readField` now uses two new helpers, `showFieldOk` and `showFieldError`, and Zyl/Achse reuse them. There is no behaviour change for the existing fields.
- `specFor` now takes an `{sph, cyl, axisDeg}` object. The bench specs use `sphOnly(...)`. Their values are unchanged, and 01-10 still owns their replacement.

## Requirements

- **RX-03: complete.** Plus-cylinder input is transposed and both forms are shown.
- **RX-02: complete.** The axis field with `°`, `x` and `×` input and the de-AT echo now exists. Earlier it was pending only for lack of that field (01-03 decision).
- **L10N-01: still pending.** `result.notComputable` still shows a raw engine code until the 01-10 diagnostic texts land.
- **L10N-02:** already complete. The new strings all live in the one dictionary.

## Known Stubs

None.

## Notes for later plans

- 01-10: `result.notComputable` still shows `{code}`. Cylinder cases can now reach BACK_SAG_UNDEFINED from the page, for example −12 −6 × 10 in 62×55/18, PD 32 (the 01-08 engine test; not re-checked on the page).
- Phase 2 (RX-04): no range check after transposition yet. For example, +11 +3 transposes to Sph +14.

## Self-Check: PASSED
