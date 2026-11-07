---
phase: 02-lay-first-german-input-results-comparison
plan: 03
subsystem: rx-input, validation, ui-infrastructure
tags: [rx-table, validation-tiers, debounce, toggletip, icons, card-reflow, container-query, de-AT]
requires: ["02-02"]
provides:
  - "src/state/validate.js: TIERS, VAL_CODES, RX_RANGES, STEP_DPT, validateRxEye (codes + data, no text)"
  - "src/state/debounce.js: createDebouncer(setTimer, clearTimer, ms) { call, flush, cancel, isPending }, MESSAGE_PAUSE_MS = 600"
  - "src/ui/icons.js: icon(name) for info, error, hint, outside, check, chevron"
  - "src/ui/toggletip.js: initToggletips(root), APG disclosure for every button.tip-btn[aria-controls]"
  - "src/ui/rx-input.js: initRxInput, readRxEye, eyeStatus, readMmField, fmtForm"
  - "src/ui/results.js: renderBlocked(eye, fieldId), initResultJumps()"
  - "e2e/rx.spec.js"
affects: [02-04 (smart PD, frame fields can adopt the tier messages), every later slice (toggletips and icons), 02-15 (deploy)]
tech-stack:
  added: []
  patterns: [message display debounced and compute not debounced, tier = text label + icon + box, CSS container-query reflow of one table, readonly mirror instead of disabled]
key-files:
  created:
    - src/state/validate.js
    - src/state/validate.test.js
    - src/state/debounce.js
    - src/state/debounce.test.js
    - src/ui/rx-input.js
    - src/ui/toggletip.js
    - src/ui/icons.js
    - e2e/rx.spec.js
  modified:
    - index.html
    - src/ui/main.js
    - src/ui/results.js
    - src/ui/style.css
    - src/i18n/de-AT.js
    - src/i18n/dictionary.test.js
    - e2e/smoke.spec.js
decisions:
  - "[02-03]: In card mode the Rx header row stays visible as a row of terms with their tip buttons. Only the 'Auge' cell is hidden. The UI-SPEC says thead is visually hidden, but that would leave four focusable tip buttons invisible (WCAG 2.4.7)"
  - "[02-03]: Out-of-model range texts use {min}/{max} placeholders from RX_RANGES instead of literal numbers, so the dictionary never duplicates a range ('−12,00 dpt bis +12,00 dpt')"
  - "[02-03]: Sph range is checked on the minus-cylinder form; for a plus cylinder the message appends 'Ihre Eingabe: <typed form>' (val.transposedSuffix)"
  - "[02-03]: Contact-lens text (BC/DIA) is a Fehler; the numeric BC look-alike (one decimal, 7,5–9,5, unsigned, off-step) is a Hinweis; a DIA-like Sph 13–15 is out of model plus a suffix"
  - "[02-03]: A message on screen that no longer fits the value is removed at once; the new one waits for the pause. A keystroke restarts the pause, an unrelated input frame does not"
  - "[02-03]: Sph +16 is now stopped by the RX-04 field check, so the engine's +14,00 limit text is no longer reachable from the Sph field (smoke test rewritten)"
  - "[02-03]: UX-01 is not marked complete: only the 4 Rx terms have tips; Brechungsindex, Basiskurve, Mittendicke, Randdicke, A, B, DBL, Dezentration follow in later slices"
metrics:
  duration: 20min
  completed: 2026-11-07
  tasks: 2
  files: 19
---

# Phase 2 Plan 03: Paper-shaped Rx table with tiered help Summary

The Rx entry is now a German table laid out like the paper prescription. Below a 560 px container width it reflows into one card per eye. Each field message has one of three tiers (Fehler, Hinweis, Außerhalb des Modells). Messages appear after a 600 ms pause or on blur, and "Meinten Sie −2,25?" has an apply button. Values are never clamped. The page also has a "±" button for iPhones, a read-only "Linkes Auge gleich wie rechtes" mirror, a collapsible explanation of Add, Prisma, HSA, F/N and EP/H, and APG toggletips for Sph, Zyl, Achse and PD.

## What was built

- **validate.js** (pure): one message per field, priority error > out-of-model > hint. The model range is checked on `transpose().minus` (Pitfall 8). For off-step values the suggestion is the nearest 0,25. A tie (exact ,125) would round away from zero, but two typed decimals can never produce one. The engine rx is always the entered value, never rounded. The tests include a fast-check property with 300 runs over four random 64-character strings.
- **debounce.js**: injected timers, `flush()` for blur.
- **rx-input.js**: the echo and both cylinder forms update every frame. Messages go through one debouncer per field, and `aria-live` announcements stay calm because nothing is rewritten when the signature is unchanged. `eyeStatus()` tells the card whether a blocking message is still pending. While it is pending the card shows "Eingabe unvollständig …". Once the message is shown the card shows "Für dieses Glas wird nichts berechnet …" plus a "Zum markierten Feld" button. `client.request` is still called only from `update()`, in every input frame.
- **Card reflow**: `form#rx { container: rx / inline-size }`, a 2×2 grid per eye, and one column below 280 px. The 02-02 open point is fixed: at 320 px the row headers and labels no longer break mid-word, and the only breaks left are proper hyphenation inside long message text. Screenshots: `/tmp/claude-1000/-home-nuc8-05-development-45-brille/3ed767a8-1239-46ae-8f86-b2a6de7bb434/scratchpad/rx-320.png` and `/tmp/claude-1000/-home-nuc8-05-development-45-brille/3ed767a8-1239-46ae-8f86-b2a6de7bb434/scratchpad/rx-1280.png`.
- **Icons**: the SVGs use presentation attributes only (CSP). The frame-field errors also get the `error` icon instead of the old CSS `⚠`.

## Verification (real output)

- `npm run lint && npm run test:coverage && npm run build && npm run test:e2e` → exit 0. Vitest: 29 files, 1180 tests passed, coverage of all files 98.47 % statements / 96.42 % branches / 100 % functions / 99.18 % lines. Build ✓. Playwright: 154 passed (desktop + mobile).
- `e2e/rx.spec.js`: axe on `#rx` with all four tips open and one message of each tier, at 320 and 1280 px, tags wcag2a/2aa/21a/21aa/22aa → zero violations; `scrollWidth <= clientWidth` at 320.
- The task acceptance greps passed: 4 `class="sign"`, 4 `class="tip-btn"`, 1 `<details id="rx-other">`, no `disabled = true`, no `innerHTML` and no `setAttribute('style'` in the three new UI files. No "Einstärkenglas" anywhere.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Smoke test 'very strong plus beyond the model range' no longer matched the behaviour**
- **Found during:** Task 2
- **Issue:** Sph +16 is now outside RX-04, so the field blocks the eye before the engine runs and the engine's "+14,00 dpt" diagnostic is never shown.
- **Fix:** the test now asserts the out-of-model field message and the blocked card sentence.
- **Files modified:** e2e/smoke.spec.js
- **Commit:** 0f7a15c

**2. [Rule 2 - Accessibility] The card-mode header stays visible**
- The UI-SPEC says `thead` is visually hidden in card mode. Doing that would hide the four focusable tip buttons, so the header row is shown as a row of terms and only the "Auge" cell is hidden.
- **Commit:** 0f7a15c

**3. [Rule 3 - Blocking] The PD label is shorter**
- "PD … in Millimetern (Abstand Nasenmitte bis Pupille)" did not fit as a visible label in a 2×2 card cell. It now reads "PD rechtes Auge in Millimetern", and the explanation moved into `tip.pd.text`.

**4. Scope adjustments**
- `readPdField` is **not** exported. PD is validated inside `validateRxEye` and returned by `readRxEye`. A separate export would have been dead code; 02-04 (smart PD) can add it.
- The input listeners of the eight Rx fields stay in `initExample` (they already call `onInput`). `initRxInput` wires blur, the "±" buttons and the mirror. Adding a second input listener would have doubled scheduling.
- The phase-1 keys `rx.sph.label`, `rx.cyl.label` and `rx.axis.label` were removed together with `#rx-hint`, `#rx-cyl-hint` and `#rx-axis-hint`. Their content is now in the tips.
- The plan asked for "class link"; the existing `.link-button` class was used instead.
- Task 2 was committed as a single commit, as the plan specified. The e2e spec was written and run in the same task, not committed separately as RED.

## Known Stubs

None. The frame fields A/B/DBL still use the immediate phase-1 messages, with the new icon. That is intentional until 02-04.

## Open points for the verifier

- In table mode at 1280 px the Rx input column is narrow, about 112 px for "±" plus the input, so "−0,75" just fits. At 320 px, card cells are about 120 px wide, so long out-of-model messages wrap into many hyphenated lines. Both pass the layout gates, but the lens-critic or the user may want message boxes that span the full card width.
- The screen-reader pass (TalkBack/VoiceOver) for card mode, the sign button and the toggletips is still manual (UI-SPEC Accessibility Contract).

## Commits

- 0fe23e1 test(02-03): failing validation tier tests
- e3d7535 feat(02-03): pure Rx tier classification and message debouncer
- 0f7a15c feat(02-03): paper-shaped Rx table with tiered messages, sign button, mirror and tips

## Self-Check: PASSED
