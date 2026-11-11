# Phase 3: lens-critic result re-review (2026-11-11)

**Reviewed state:** 9b275c4 (range edf2dc9..HEAD; fullscreen probes on the live site at 0776c4a). **Verdict: NEEDS WORK**: 0 BLOCKER, 2 MAJOR, 9 MINOR. Neither MAJOR changes a number the user sees. The orchestrator wrote this file from the reviewer's report (the reviewer has no write tool).

## Checked by the reviewer

- `npx vitest run`: 46 files, 1800 tests passed. `npm run lint`: exit 0.
- CI job logs: run 42922085687 build 572 passed / 38 skipped, no flaky line; verify-live the same. Run 42907320977 failed on `layout.spec.js:302` and `view.spec.js:381`.
- Fullscreen probes and an off-grid D-04(c) axis sweep (scripts in the session scratchpad).
- **M2 fixed:** `paintProtrusion` uses `protrusionCompareLines`; A uses its own rim depth; unit + e2e (view-compare.spec.js:396) compare the mm values with the Expert rim lines of A and B.
- **M1 code matches the restated bound** (tessellation.test.js asserts ≤ 0,01 / 0,025 mm up to etMax 31 mm, guards above, ≤ 0,6 % everywhere). Comments in tiers.js and topology.js corrected.
- MINOR 2, 3, 4, 5, 6, 8 of the first review: fixed or tested as 03-LC-FIX.md says; MINOR 9 needed no change.

## Findings and what was done

| ID | Finding | Done (2026-11-11) |
|---|---|---|
| MA-1 | VIZ-06 / SC-4 recorded as "measured" from 412 px desktop-GPU numbers; 03-VALIDATION approval with three ⬜ rows and `status: draft`; item (iv) thumbnail cannot be judged from "works excellent" | Reworded: SC-4 real-phone measurement **accepted unmet**, desktop-GPU numbers supporting only (03-17-SUMMARY, 03-VALIDATION, REQUIREMENTS). The three ⬜ rows filled from 03-17-SUMMARY or marked accepted unmet (heap snapshot diff never taken). Status approved. (iv) recorded as unknown; a 30-second Pixel check is asked of the user |
| MA-2 | CSS fullscreen fallback: Tab reached covered controls (WCAG 2.4.11), VoiceOver could read the hidden page | `fullscreen.js`: every sibling on the path stage → body is `inert` while the overlay is up; focusable ancestors (the desktop `.col-results` region, tabindex 0) leave the Tab order; restored on exit; focus returns to the button. New e2e in view-fullscreen.spec.js (Tab/Shift+Tab reach only the stage and the button; inert removed and tabindex restored after exit), desktop + mobile |
| m1 | One CI retry hides flaky results; softens DEPL-02 for never-happens tests | Deferred (deferred-items.md): report flaky tests in the step summary, `retries: 0` on never-happens and race tests, `failOnFlakyTests` after `layout.spec.js:302` is fixed properly |
| m2 | Fullscreen hides the legend, the table-only note and the keyboard hint; the hidden hint still costs callouts | Partly: the hint's avoid box is skipped while fullscreen (`view.js`). A compact legend and note inside the stage: deferred |
| m3 | D-04(c) worst case is grid-only; axis 150 gives 0,1169 mm (0,204 %) | Pinned in tessellation.test.js (also custom nₑ 1,40 at axis 150, 0,0447 mm); guard 0,12 mm; comments and 03-CONTEXT D-04(c) say ≥ 0,117 mm, within the accepted bound only through its 0,6 % clause |
| m4 | Button-to-bottom-corner branch has no assertion | Deferred |
| m5 | Thumbnail guard tested in one direction only | Deferred |
| m6 | Stale "15 s" comment in e2e/helpers.js | Fixed |
| m7 | 03-VERIFICATION.md premature | Updated with this verdict |
| m8 | Version label hard-coded in two places | `version.js` (APP_VERSION) is the single source; vite.config.js injects it, smoke.spec.js imports it |
| m9 | Fullscreen button name only from `title` | Accepted (e2e asserts the accessible name; no overlap found) |
