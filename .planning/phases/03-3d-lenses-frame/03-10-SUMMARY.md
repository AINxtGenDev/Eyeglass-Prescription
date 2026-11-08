---
phase: 03-3d-lenses-frame
plan: 10
subsystem: ui/view (touch camera path)
tags: [VIZ-03, D-15, R1-6, lens-critic MINOR 8, T-03-51]
requires: [controls.js createControls with the any-pointer coarse split (03-09), OrbitControls r187 connect/disconnect, icons.js, #view-tools (03-09)]
provides: [#view-rotate '3D drehen' toggle (aria-pressed), .view-stage--static (touch-action pan-y pinch-zoom), IntersectionObserver auto-off (threshold 0.5), icon('rotate'), view.rotate / view.hint.touchOff / view.hint.touchOn, controls.rotateActive(), __eyeglassView.rotateActive(), mobile touch e2e]
affects: [03-11 (Seite protrusion; VIZ-03 completes there), 03-15/03-17 (real-device touch check)]
tech-stack:
  added: []
  patterns: [explicit opt-in toggle instead of first-tap activation, OrbitControls connect()/disconnect() as the touch-action switch, IntersectionObserver release so the canvas cannot trap scrolling, CDP Input.dispatchTouchEvent for touch e2e]
key-files:
  created: []
  modified:
    - src/ui/view/controls.js
    - src/ui/view/view.js
    - src/ui/icons.js
    - index.html
    - src/ui/style.css
    - src/i18n/de-AT.js
    - e2e/view-controls.spec.js
decisions:
  - "03-10: on the touch path enableZoom follows the '3D drehen' state (r187 only starts a touch dolly when enableZoom is true); on the pointer path it still follows stage focus"
  - "03-10: pressed '3D drehen' swaps the rotate icon for check (UI-SPEC accent item 9: accent fill, white text, check icon)"
  - "03-10: disconnecting mid-gesture clears the drag state (OrbitControls sends no 'end' after disconnect)"
  - "03-10: e2e touch scrolling uses CDP Input.dispatchTouchEvent; Input.synthesizeScrollGesture with gestureSourceType 'touch' scrolls nothing in this headless Chromium"
metrics:
  duration: ~45 min
  completed: 2026-11-08
  tasks: 2
  files: 7
---

# Phase 3 Plan 10: '3D drehen' touch toggle with scroll safety Summary

On any device with a coarse pointer (`matchMedia('(any-pointer: coarse)')`: phones, tablets, hybrid touch laptops), the 3D view now stays static at rest. The stage has `touch-action: pan-y pinch-zoom` and the controls are not connected, so one-finger page scrolling passes through. An explicit "3D drehen" toggle (`aria-pressed`) connects OrbitControls, and r187's `connect()` sets `touch-action: none` on the stage only. While it is on, one finger rotates and two fingers pinch and pan. It turns off on a second tap, or when less than 50 % of the stage is in the viewport. Presets and the keyboard keep working at rest. The desktop pointer path is unchanged, and the toggle stays hidden there.

## What was built

- **`controls.js`, touch path (`!pointer`).**
  - At rest: class `view-stage--static`, `#view-rotate` un-hidden with `icon('rotate')`, and the hint set to `view.hint.touchOff`.
  - Turning it on (`setActive(true)`): `controls.connect(stage)`, the static class removed, `enableZoom` true, `aria-pressed="true"`, the check icon, and the hint set to `view.hint.touchOn`.
  - Turning it off reverses this. `disconnect()` restores the inline touch-action to `''` and the class comes back. Any drag state still open is cleared.
  - An `IntersectionObserver` (`threshold: [0.5]`) calls `setActive(false)` when `intersectionRatio < 0.5` while the toggle is on.
  - `rotateActive()` returns the state; it is always false on the pointer path.
- **`view.js`:** the debug handle gains `rotateActive()`.
- **`index.html`:** `button#view-rotate type="button" aria-pressed="false" hidden` after the preset group in `#view-tools`. It is the last stop in the Tab order after "Ansicht zurücksetzen", as UI-SPEC specifies.
- **`icons.js`:** `rotate` is a 330° arc (r 5,5) with an L-shaped arrowhead, 16×16, `stroke=currentColor`, `aria-hidden`.
- **`style.css`:**
  - `#view-rotate[aria-pressed='true']` uses the accent fill (`--accent` #0b57d0) with white text.
  - `.view-stage--static { touch-action: pan-y pinch-zoom; }`.
  - The toolbar keeps the 03-09 flex wrap with an 8 px gap.
- **`de-AT.js`:** `view.rotate`, `view.hint.touchOff` and `view.hint.touchOn`, verbatim from UI-SPEC.

## Verification (run by this executor, one after the other)

| Check | Result |
|---|---|
| `npm run lint` | exit 0, clean |
| `npm run test:coverage` | 43 files, **1747 tests passed**; engine coverage All files 98.91 % stmts / 96.87 % branch / 100 % funcs / 99.48 % lines |
| `npm run build` | `✓ built in 352ms` |
| port 4173 before e2e | `000` |
| `npm run test:e2e` (full) | **464 passed, 10 skipped (8.5 m)**, exit 0 (03-09: 457 passed, 3 skipped; +7 new tests, the skips are project-gated touch/pointer variants) |
| Task 1 verify: `npx playwright test e2e/view-controls.spec.js --project=desktop` | 11 passed (2.9 m) |
| Task 2: `--project=mobile` view-controls | 13 passed, 3 skipped (2.0 m); then the 2 toolbar-layout tests, 2 passed |

Acceptance greps:
- `any-pointer: coarse` in controls.js = 2, and `'(pointer: coarse)'` = 0.
- `IntersectionObserver` = 2, and `aria-pressed` = 2.
- `'rotate'` in icons.js = 1, and `id="view-rotate"` in index.html = 1.

### Mobile e2e (project mobile: 360×780, isMobile, hasTouch)

- **any-pointer: coarse is asserted, not emulated.** Playwright's `hasTouch` already makes Chromium match `(any-pointer: coarse)`. A `beforeEach` asserts `matchMedia('(any-pointer: coarse)').matches === true`, so the tests fail loudly if that ever changes. The spec comment says so.
- **'touch at rest scrolls the page':**
  - The toggle is visible with `aria-pressed` false, and the hint text is exact.
  - The computed touch-action contains `pan-y`.
  - A CDP one-finger upward drag (150 px) on the stage centre increases the page scroll by more than 50 px, and the camera state is unchanged to 6 decimals.
- **'3D drehen':**
  - After a tap: `aria-pressed` true, computed touch-action `none`, the `touchOn` hint text, and the button colours rgb(11, 87, 208) / rgb(255, 255, 255).
  - A horizontal one-finger drag changes the azimuth by more than 5°, and a vertical drag changes the elevation by more than 3°. **The page scroll is unchanged across both drags**, and the view becomes 'free'.
  - A two-finger pinch apart reduces the distance by more than 1 mm.
  - A second tap sets `aria-pressed` false, touch-action back to `pan-y`, and the `touchOff` hint.
- **'auto-off':** with the toggle on, the page scrolls until the stage bottom is above the viewport. `aria-pressed` reads false within 1 s, and touch-action is `pan-y` again.
- **'presets at rest':** tapping Seite gives `viewName()` 'side' while `rotateActive()` stays false.
- **Keyboard (existing test, both projects):** on the touch path, Tab after "Ansicht zurücksetzen" lands on `#view-rotate`.
- **Toolbar at 412×915 and 320×640** (mobile project, at rest and pressed):
  - `scrollWidth == innerWidth`.
  - All 5 toolbar buttons are ≥ 44×44 px and inside `#view-tools`.
- **Desktop:** `#view-rotate` is hidden, and the stage has no static class.

### Visual check (Playwright screenshots; the chrome-devtools MCP was not available to this executor)

Screenshots at 412×915 and 320×640 with touch emulation, plus 1280×800 without it:

- **At rest:** an outlined "↻ 3D drehen" on its own row under "Ansicht zurücksetzen". The hint reads "Tippen Sie auf „3D drehen“, um die Brille mit dem Finger zu drehen."
- **Pressed:** a blue filled button with white "✓ 3D drehen". The hint becomes the three-line touchOn text.
- **After scrolling 1200 px away and back:** the button is outlined again (`aria-pressed` false).
- **Width:** scrollWidth 412 = 412 and 320 = 320. At 320 the presets wrap as Vorne/Seite/Oben, then Ansicht zurücksetzen, then 3D drehen.
- **1280×800:** "3D drehen" is absent. A mouse drag turned the azimuth from −35° to −121,6°.
- **Console:** only Chromium's "GL Driver Message … GPU stall due to ReadPixels" performance notes (headless compositor readback, already whitelisted in helpers.js). There are no app warnings or errors.

The screenshots are in /tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/ (rest-412.png, on-412.png, released-412.png, rest-320.png, on-320.png, released-320.png, desk-1280.png). That is a session scratch directory and is not published.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pinch would not zoom on the touch path**
- **Found during:** Task 1, reading the r187 OrbitControls source. `_handleTouchStartDollyPan` / `_handleTouchMoveDollyPan` dolly only `if (this.enableZoom)`.
- **Issue:** The 03-09 code set `enableZoom` only from stage focus and only on the pointer path, so two-finger zoom would have been dead after "3D drehen".
- **Fix:** `syncZoom` sets `enableZoom = pointer ? focused : active`. The e2e pinch test asserts the distance drops.
- **Commit:** 99fcf40

**2. [Rule 1 - Bug] Drag state could stick after an auto-off mid-gesture**
- **Issue:** `disconnect()` removes the listeners, so OrbitControls never sends 'end'. The `dragging` flag (and with it `setInteracting(true)`) would have stayed set.
- **Fix:** `setActive(false)` clears `dragging` / `dragFrom` and calls `setInteracting(false)`.
- **Commit:** 99fcf40

**3. [Rule 3] Touch scroll tool in e2e**
- **Issue:** The plan named CDP `Input.synthesizeScrollGesture`. With `gestureSourceType: 'touch'` it scrolls nothing anywhere on the page in this headless Chromium (measured: 4694 → 4694). 'default' / 'mouse' scroll 300 px, but by wheel, so they would not test touch-action.
- **Fix:** The scroll proof uses `Input.dispatchTouchEvent` one-finger drags. A drag on the stage at rest scrolled the page 265 px in the probe. The same kind of drag does **not** scroll the page while the toggle is on (asserted), so this is a real touch-action check rather than a no-op.
- **Commit:** dd0d5aa

**4. Additions beyond the plan**
- The pressed state swaps to the `check` icon, because UI-SPEC accent item 9 lists the check icon for the pressed state. The plan text only mentioned prepending `rotate`.
- Extra e2e tests: the toolbar layout at 412×915 / 320×640 (the orchestrator's layout requirement), the Tab order including `#view-rotate` on touch, the pinch check, and "hidden on the pointer path" on desktop.

## For lens-critic

- **Hybrid laptop wheel while the toggle is on.** On the touch path `enableZoom` is true whenever "3D drehen" is on, so a mouse wheel over the stage zooms without the stage having focus. That differs from the desktop focus rule. It needs an explicit opt-in, and the toggle releases itself when the stage scrolls away. Splitting pinch from the wheel would need a custom wheel guard.
- **Turning the toggle on while the stage is less than 50 % visible.** The observer only fires on threshold crossings. If the user taps "3D drehen" while the stage is already below 50 % visible, it stays on until the stage crosses 50 % again. Touches outside the stage still scroll the page. On phones the button sits directly under the stage, so this case is unlikely.
- **Layout below the button.** The touchOn hint is longer than touchOff (3 lines vs 2 at 320 px), so the caption below moves by about one line when toggled. The button itself does not move under the finger.
- **Not covered by automated tests:** real iOS Safari or Android Chrome touch behaviour, including browser pinch-zoom of the page at rest. UI-SPEC lists a real-iPhone check as an open human item (03-15/03-17).

## Requirements

- **VIZ-03 stays Pending.** Touch is now done, but the requirement also needs "the side view shows protrusion beyond the rim", which 03-11 delivers.
- **VIZ-06 was not touched and stays Pending.** It needs a real-device measurement in 03-15/03-17.

## Known Stubs

None.

## Threat Flags

None. T-03-51 (scroll trap) is mitigated as planned: static at rest on any coarse pointer, an explicit toggle, IntersectionObserver auto-off, and e2e tests for scroll at rest, no scroll while on, and auto-off.

## Self-Check: PASSED

Commits 99fcf40 and dd0d5aa exist; all 7 modified files exist; gates re-run after the last code commit.
