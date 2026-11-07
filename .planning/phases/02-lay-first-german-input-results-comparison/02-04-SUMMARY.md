---
phase: 02-lay-first-german-input-results-comparison
plan: 04
subsystem: frame-input, smart-pd, validation
tags: [temple-stamp, shape-cards, radio-cards, smart-pd, frame-ranges, b-estimate, svg, de-AT]
requires: ["02-03"]
provides:
  - "src/state/parse.js: parsePd, parseStamp, PD_CODES, STAMP_CODES (length cap 32 before any regex)"
  - "src/state/frame.js: PD_DEFAULT_MM = 32 (ANSUR 2012), FRAME_RANGES (FRAME-02), estimateB(shape, A)"
  - "src/state/validate.js: resolvePd({ od, os }) over both PD fields, validateFrame({ A, B, DBL }); validateRxEye no longer owns PD"
  - "src/ui/frame-input.js: initFrameInput, readFrame, currentShape, frameStatus"
  - "src/ui/rx-input.js: readRx() (both eyes), showFieldMessage / messageStatus / flushOnBlur shared with the frame fields"
  - "src/ui/results.js: renderPdNote(eyes), renderBNote(B)"
  - "e2e/frame.spec.js"
affects: [02-05+ (frame presets #frame-presets go under the shape cards), 02-07 (material cards replace #material select), later comparison slices (read readFrame().frame)]
tech-stack:
  added: []
  patterns: [transparent native radio over the whole card, one debounced message mechanism for Rx and frame fields, blocking Hinweis (question) via explicit blocks flag, never write into a focused field]
key-files:
  created:
    - src/state/frame.js
    - src/state/frame.test.js
    - src/ui/frame-input.js
    - e2e/frame.spec.js
  modified:
    - src/state/parse.js
    - src/state/parse.test.js
    - src/state/validate.js
    - src/state/validate.test.js
    - src/ui/rx-input.js
    - src/ui/results.js
    - src/ui/main.js
    - src/ui/style.css
    - index.html
    - src/i18n/de-AT.js
    - src/i18n/dictionary.test.js
    - e2e/smoke.spec.js
    - e2e/perf-throttled.spec.js
    - e2e/results.spec.js
    - e2e/expert.spec.js
    - e2e/rx.spec.js
decisions:
  - "[02-04]: PD conflicts never guess: a pair or binocular value in one field and a different value in the other field gives VAL_PD_CONFLICT (Hinweis) on the other field and blocks that eye; equal values are no conflict"
  - "[02-04]: '64/32' (one value of each kind) is PD_AMBIGUOUS; a pair half that is empty ('32/') is PARSE_NOT_A_NUMBER, not an empty field"
  - "[02-04]: A question elsewhere does not withhold the default from the other, empty eye: it gets 32 mm, stated in #pd-note (plan wording 'that eye is not computed')"
  - "[02-04]: An invalid or swapped stamp blocks both eyes (the stamp text would contradict the A/DBL being computed); the swapped Hinweis has an apply button"
  - "[02-04]: An estimated B outside 28–55 mm (e.g. Rund at A 62 → 57) is still Außerhalb des Modells: the model cannot compute it, the user can type B"
  - "[02-04]: The estimate is never written into B while B has focus or after the user emptied it (the computation still uses it); found as a real race under load ('45'+'55' → '4555')"
  - "[02-04]: #pd-note and #b-note appear only for eyes that are actually computed with the assumed value"
  - "[02-04]: The section sits outside form#rx and before the material field (UI-SPEC DOM order: Rx, Fassung, Material)"
  - "[02-04]: FRAME-02 not marked complete: the A/B/DBL ranges and shape defaults are done, the rim depth (#frame-rim) is planned in 02-11"
  - "[02-04]: UX-01 not marked complete: A, B, DBL and Stempel tips added; Brechungsindex, Basiskurve, Mittendicke, Randdicke, Dezentration still missing"
metrics:
  duration: 36min
  completed: 2026-11-07
  tasks: 2
  files: 20
---

# Phase 2 Plan 04: Temple stamp, shape cards and smart PD Summary

The frame is now entered the lay way. The temple stamp ("52□18 140" and six other separator forms) fills A and DBL. Our own SVG of a temple with a magnifier sits behind "Wo finde ich das?". The shape is picked from four radio cards whose outlines come from `frameOutline`. B follows the shape ratio until the user types it, and that is stated in the result. The PD accepts "32", "32/33", "64" and asks instead of guessing for 40–50, two values over 50, and values that look like the HSA. An empty PD becomes 32 mm per eye and the result says so.

## What was built

- **parsePd / parseStamp** (pure): both cap the raw text at 32 characters before any regex. The patterns are anchored and have no nested quantifiers. A fast-check property runs 500 random strings of up to 64 characters through both. Binocular halves are rounded to 0,5 mm. Stamp numbers that look swapped come back as `STAMP_SWAPPED` with the corrected values, and they are never applied without the user's action.
- **resolvePd**: reads both PD fields together. For each eye it returns a value, a source (`typed | pair | binocular | default`), at most one message per field, and `blockedBy`, which names the field whose message blocks that eye. That can be the other eye's field, e.g. "20/33" typed on the left blocks the right eye from the left field.
- **frame.js**: `PD_DEFAULT_MM = 32`, with the ANSUR 2012 comment and the caveat that it is a US Army sample, not DACH. `FRAME_RANGES` are verbatim from FRAME-02. `estimateB` returns `Math.round(A × B_def / A_def)`.
- **frame-input.js**: thumbnails are built once at init with `frameOutline(id, A_def, B_def, 'OD', 72)` and never per keystroke. Typing A or DBL rewrites the stamp, keeping the temple length. The stamp writes A and DBL once, without synthetic input events. "Standardmaße übernehmen" is shown when typed sizes differ from the shape defaults.
- **Shared messages**: the frame fields now use the same tiered, 600 ms debounced messages as the Rx fields (`showFieldMessage`). A frame block puts both cards into the blocked state, and "Zum markierten Feld" moves focus to the frame field.
- **Radio cards**: the native radio covers the card and is transparent (opacity 0). It is not `visually-hidden`, so the whole card is one hit target, keyboard and screen-reader behaviour stay native, and Playwright `check()` works.

## Verification (real output)

- `npm run lint && npm run test:coverage && npm run build && npm run test:e2e`: every step passed.
  - Lint: clean.
  - Vitest: 30 files, 1279 tests passed. All-files coverage is 98.47 % statements, 96.42 % branches, 100 % functions, 99.18 % lines.
  - Build: ✓.
  - Playwright: 182 passed (desktop + mobile), exit 0.
- `e2e/frame.spec.js`: 26 passed. Axe on `#frame-section`, with the figure and all four tips open and the swapped-stamp Hinweis shown, at 320 px and 1280 px, tags wcag2a/2aa/21a/21aa/22aa: zero violations. `scrollWidth <= clientWidth` at 320 px. `smoke.spec.js` + `frame.spec.js` with `--repeat-each=3`: 228 passed.
- Acceptance greps:
  - 0 `<select id="frame-shape"` and 1 `id="frame-shape"` in `index.html`.
  - `frameOutline(` appears only in `thumbnail()`, which is called from the init-time `buildShapeCards`.
  - 0 `selectOption` shape uses in smoke/perf.
  - `grep -rn "references/" src/ index.html` finds only the pre-existing phase-1 comment in `src/engine/frame/shapes.js` (lines 10–11, a note about which images were checked). Nothing is imported or copied.
- Screenshots: `/tmp/claude-1000/-home-nuc8-05-development-45-brille/3ed767a8-1239-46ae-8f86-b2a6de7bb434/scratchpad/frame-320.png`, `/tmp/claude-1000/-home-nuc8-05-development-45-brille/3ed767a8-1239-46ae-8f86-b2a6de7bb434/scratchpad/frame-1280.png`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The estimated B was written into a field the user was typing into**
- **Found during:** Task 2, full e2e run. smoke "SC-4" and "oversized lens" were flaky under parallel load, and B showed "4555".
- **Fix:** the estimate is never written while B has focus. The value used for the computation is unchanged.
- **Commit:** b62d1c6

**2. [Rule 1 - Bug] The stamp echo overflowed at 360 px**
- **Issue:** the stamp echo sentence used the `nowrap` chip style. The overflow zoomed out the mobile page, so clicks missed their targets.
- **Fix:** the stamp and B echoes wrap.
- **Commit:** b62d1c6

**3. [Rule 1 - Bug] The card status used a stale frame "pending" flag**
- **Fix:** `frameStatus()` reads the message states fresh, so the blocked sentence replaces "Eingabe unvollständig …" once the message appears.
- **Commit:** b62d1c6

**4. [Rule 3 - Blocking] The page had to stay working between the two commits**
- Task 1 removed PD from `validateRxEye`. So that the page did not break at commit dcdb26a, that commit also carries a 5-line `resolvePd` bridge in rx-input.js, and the phase-1 `frame.legend` / `frame.shape.label` / `frame.hint` keys were kept until Task 2 removed the fieldset.

**5. [Rule 3 - Blocking] More e2e files used the shape select**
- `e2e/results.spec.js` and `e2e/expert.spec.js` also called `#frame-shape` `selectOption`. Both now use radio `check()`, in the same commit as the markup change.

**6. Scope adjustments**
- The plan's `class link` is the existing `.link-button`, as in 02-03.
- `readRxEye(eye)` was replaced by `readRx()`, because PD now needs both fields at once.
- The radio is not `visually-hidden`: it is a transparent overlay over the card (see "Radio cards").

## Requirements

RX-06 and FRAME-03 are marked complete. FRAME-02 stays pending: the A/B/DBL ranges and shape defaults are delivered, but the requirement also names rim depth, which 02-11 adds. UX-01 stays pending: five term tips are still missing.

## Known Stubs

None blocking the plan goal. `#frame-presets` (UI-SPEC frame chips) and the material radio cards are later slices; `#material` is still the select (02-07).

## Open points for the verifier / lens-critic

- `VAL_PD_CONFLICT` and the stamp texts that are not in the UI-SPEC are our own wording. Please review: `val.VAL_PD_CONFLICT`, `val.VAL_PD_QUESTION` ("Bis dahin wird für dieses Auge nichts berechnet."), `stamp.svg.title` and `stamp.svg.desc`.
- The HSA band 8–20 mm is still [ASSUMED, RESEARCH A5].
- The magnifier SVG overlaps the temple bar on purpose. I checked it by eye at 320 px and 1280 px; it has not had a design review.
- At thumbnail size the pilot and panto outlines look alike. They come from the engine's model shapes.
- The screen-reader pass for the radio cards and the figure disclosure is still manual.

## Commits

- 6e1ea00 test(02-04): failing PD/stamp/frame tests
- dcdb26a feat(02-04): PD smart parsing, temple stamp parser, B estimate and frame ranges
- b62d1c6 feat(02-04): temple stamp, shape cards, frame ranges and smart PD

## TDD Gate Compliance

RED (6e1ea00 `test`) → GREEN (dcdb26a `feat`) for Task 1. Task 2's e2e spec was the RED written in Task 1 and goes green in b62d1c6.

## Self-Check: PASSED
