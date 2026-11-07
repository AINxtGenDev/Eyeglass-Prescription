---
phase: 02-lay-first-german-input-results-comparison
plan: 18
subsystem: Rx/frame field messages (dirty rule, gesture-aware paint)
tags: [RX-04, RX-05, UX-03, lens-critic-M3, gap-closure]
requires: [02-17]
provides:
  - "Empty-Sph message 'Bitte einen Wert eingeben.' only after the user edited that eye's Sph, Zyl or Achse (trusted input, '±', 'übernehmen'); mirrored L takes R's state"
  - "Gesture tracker + afterGesture(fn) in rx-input.js: field-message paints wait until the click of the current pointer gesture has been dispatched; removal stays immediate"
  - "MJ-2: queuedSig counts as pending; deferred paint idempotent"
affects: [src/ui/rx-input.js, e2e/rx.spec.js, e2e/frame.spec.js, e2e/presets.spec.js, 02-UI-SPEC.md, deferred-items.md]
tech-stack:
  added: []
  patterns:
    - "Dirty = trusted input event or explicit user button; page writes dispatch synthetic events and never mark a field"
    - "Layout-changing paints go through afterGesture so a click resolves on the element under the finger at pointerdown"
key-files:
  created: []
  modified:
    - src/ui/rx-input.js
    - e2e/rx.spec.js
    - e2e/frame.spec.js
    - e2e/presets.spec.js
    - .planning/phases/02-lay-first-german-input-results-comparison/02-UI-SPEC.md
    - .planning/phases/02-lay-first-german-input-results-comparison/deferred-items.md
decisions:
  - "No clearDirty (amendment m-e): dirty is set only by trusted input events plus '±' and 'übernehmen'; presets.js dispatches a synthetic input and the example/'Eigene Werte eingeben' write values without events, so page writes never mark a field. main.js and presets.js are untouched."
  - "Eye rule (m-e): an edited Zyl or Achse of an eye makes its empty Sph show the message; with 'gleich wie rechts' on, L uses R's edit state"
  - "Message deferral instead of a reserved message line (plan design decision, lens-critic m7)"
  - "Blur grace (250 ms): a Tab that arrives before the keystroke's input frame flushes the message on that read instead of starting a fresh 600 ms pause"
metrics:
  duration: "~75 min"
  completed: 2026-11-07
  tasks: 2
---

# Phase 02 Plan 18: Untouched-field rule and click-safe message paint (M3) Summary

Closes lens-critic MAJOR M3. An empty Sph the user never edited no longer shows "Fehler: Bitte einen Wert eingeben.". The eye stays blocked and the card keeps its empty state. A message that becomes due on a pointer blur is painted only after that gesture's click, so the click lands where the user aimed. A keyboard blur still paints at once.

## Tasks

| Task | Commit | What |
|------|--------|------|
| 1 RED | bc6431d | rx.spec 'RX-05 M3' dirty-rule cases (untouched case failed on both projects) |
| 1 GREEN | a6ef91e | dirty set + eye rule in readRx; presets.spec 02-14 wait removed |
| 2 RED | 1df18a1 | click/tap-lands, MJ-2, Tab, m-d tests; frame.spec FRAME-03 M3 |
| 2 GREEN | a7c0df4 | gesture tracker, afterGesture, queuedSig, blur grace; UI-SPEC, deferred-items |

RED evidence (Task 2, before the fix): desktop `#rx-same` click was lost (`toBeChecked` failed). On both projects the frame-stamp → "Wo finde ich das?" click or tap was lost. MJ-2 and both m-d cases failed (the message was not held during a press).

## Removed 02-14 workaround (presets.spec.js)

```js
    // 02-14: the chips are below the Rx table now. The emptied R Sph shows its due message on blur
    // (or after the 600 ms pause); let it appear first, as it would before a person's next click,
    // so the click does not race the message pushing the chip down (finding in 02-14-SUMMARY).
    await page.locator('#rx-od-sph').blur();
    await expect(page.locator('#rx-od-sph-err')).toBeVisible();
```

## Verification (real output)

- `npm run lint && npm run test:coverage && npm run build && npm run test:e2e`: exit 0. Vitest: 34 files, 1573 tests passed. Coverage: all files 98.34 % statements, 96.52 % branches, 100 % functions, 99.15 % lines. Build: built in 145 ms. Playwright: 377 passed, 1 skipped.
- `npx playwright test e2e/presets.spec.js e2e/rx.spec.js e2e/frame.spec.js --repeat-each=10 --workers=4`: 1130 passed, 0 failed, 10 skipped.
- The skipped case is the MJ-2 mouse-press test on 'mobile'. With touch, the blur comes after the finger lifts, so a test cannot place an input frame inside the gesture. The tap test counts exactly one paint on 'mobile'.
- Acceptance greps: `afterGesture(` = 3 (definition, debounced paint, blur flush), `pointerdown` = 4, `PARSE_EMPTY` in rx-input.js ≥ 1. The plan's `clearDirty` greps no longer apply (amendment m-e).

## Deviations from Plan

1. **[Amendment m-e] No clearDirty.** Dirty is tracked through `e.isTrusted` plus explicit marks in `flipSign` and the "übernehmen" button. Page writes are therefore never dirty. main.js and presets.js (source) are unchanged.
2. **[Rule 3] The 02-14 workaround was removed in Task 1, not in Task 2 RED.** With the dirty rule, that flow shows no message, so the test's `toBeVisible` wait failed in Task 1.
3. **[Rule 1 - Bug] Bug in my own MJ-2 code.** An empty `queuedSig` matched the empty sig of "no message", so a removal returned early and the message stayed. Fixed with `sig !== ''` before any commit.
4. **[Rule 1 - Bug] Tab right after typing (pre-existing race).** If the blur arrived before the keystroke's input frame, the flush had nothing pending and the message came after 600 ms (measured 602.5 ms in 1 of 20 mobile runs). Fix: the blur records `blurAt`, and a read within 250 ms with the field unfocused flushes at once. After the fix: 80 of 80 passed with `--repeat-each=20`. The Tab test measures keydown → paint inside the page: the Playwright round trip alone took more than 200 ms under load, while the in-page delta was about 1–2 ms.
5. **Not reproduced by Playwright:** the mobile `locator.tap()` on `#rx-same` already passed before the fix. Chrome's tap hit-test did not lose that one. The frame-stamp tap did reproduce the lost tap on mobile. Both now pass.

## Known Stubs

None.

## Threat Flags

None. No new network, storage or markup surface; the listeners are document/window input events only.

## Self-Check: PASSED

- Files: src/ui/rx-input.js, e2e/rx.spec.js, e2e/frame.spec.js, e2e/presets.spec.js, 02-UI-SPEC.md, deferred-items.md modified (in commits above).
- Commits bc6431d, a6ef91e, 1df18a1, a7c0df4 present in `git log`.
