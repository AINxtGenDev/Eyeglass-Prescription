# Phase 3: lens-critic result review

**Date:** 2026-11-09 · **Reviewed state:** 7f44aef + f52ac80 + e5f1061 · **Verdict: NEEDS WORK**: 0 BLOCKER, 2 MAJOR, 14 MINOR.

The reviewer had no file-write tool, so the orchestrator pasted the review into this file verbatim in substance. Neither MAJOR is a correctness bug in a number the user sees.

## Checked by the reviewer

- `npx vitest run`: 46 files, 1787 tests passed (53,2 s). Lint clean on the files changed in f52ac80.
- Engine geometry, from reading rim.js and mesh/{lens,topology,frame,heat}.js:
  - Front and back normals match z = −sF and z = −CT − sB.
  - Every rim, bridge and temple z is shifted by the same lensZ as its lens.
  - OD sits at −x, and the OC decentration is nasal (PD 25 in a 62□18 frame gives oc.x = +15).
  - The thinnest and thickest points come from the CT and the edge extremes.
- The '1:2' bevel rule was checked against US 8 388 133 B2: the apex sits at t/3 from the front, which matches the code.
- Own D-04(c) scans, about 20 000 lenses: 4 shapes × 3 sizes × DBL 14/18/24 × PD 25/32/40 × Sph −12…+6 × Cyl 0/−3/−6 × 7 axes, using the same 10-point probe as tessellation.test.js.
- A plus lens in Seite (Sph +6, Playwright on :4180, 412×915).

## MAJOR

### M1. The D-04(c) tessellation bound does not hold across the input domain

**Where:** src/engine/mesh/tessellation.test.js:19-20, 98-105, 162-168; the comments at src/ui/view/tiers.js:5 and topology.js:220.

**Measured, all inputs valid in the UI:**

| Material | Rx | Frame | PD | Error | Limit |
|---|---|---|---|---|---|
| custom nₑ 1,40 | −6 −3 × 30 | Rechteckig 62×55/18 | 25 | **0,0426 mm** | 0,025 mm |
| idx174 | −12 −6 × 30 | 58×50/24 | 25 | **0,106 mm** | 0,01 mm |
| CR-39 | −12 −3 × 30 | 58×50/24 | 40 | **0,070 mm** | 0,01 mm |
| Trivex | −9 −6 × 30 | 62×40/24 | 32 | **0,055 mm** | 0,01 mm |

- The custom-nₑ case exceeds 0,0231 mm, the worst case reported so far, which came from a scan at axis 45 and DBL 14 only.
- The error sits at the far corner, where r approaches the steep back radius (r 46,4 mm against R_b 39,9 mm). Raising GRADING to 3,5 or 5 does not help (0,091 mm), so the error is angular (spoke spacing).
- It starts only at etMax ≈ 36–40 mm or more. Below that, every scanned lens met 0,01 mm. The seeded 50-sample fuzz never reached that region.

**Impact:** invisible on screen (≤ 0,2 % of the local thickness, about 0,4 px) and no displayed number changes, because the vertices are exact. But it is a user-accepted correctness bound that the documents call proven.

**Fix:**
- Restate D-04(c): ≤ 0,01 mm, and ≤ 0,025 mm for nₑ < 1,49, for etMax ≤ 35 mm; otherwise ≤ 0,25 % of the local thickness, or an absolute cap such as 0,15 mm.
- Get the user's re-acceptance.
- Replace the fuzz with a deterministic grid that includes axes 30/60/90/170 and DBL 18/24.
- Correct the tiers.js and topology.js comments.

The reviewer's scripts are in /tmp/claude-1000/-home-nuc8-05-development-45-brille/452e9d06-bf78-4049-8348-2a6a87bacea7/scratchpad/lc/.

### M2. `#view-protrusion` shows B's numbers, unlabelled, during a comparison

**Where:** src/ui/view/view.js:679-711 (`paintProtrusion` reads `last` only); confirmed in the 412 A/B shot.

**Impact:** a misattribution of the same kind as phase-2 02-17 M2. A user comparing CR-39 (A) with 1,74 (B) reads "hinten 0,5 mm" as A's value. The block also covers both eyes while the split view shows only the compared eye.

**Fix (pick one), plus an e2e assertion:**
- prefix the block with "Nachher (B):";
- show A and B lines for the compared eye;
- hide the block while comparing.

## MINOR

1. **B-IN-06 `window.__eyeglassView` in production** (view.js:1339): accepted. A same-origin script can already read the whole DOM, so the handle adds no capability. `__eyeglassNo3d` is the same case.
2. **A-IN-06, Safari retry after a failed chunk import: UNVERIFIED.** On the second rejection, fall back to `location.reload()` behind a button.
3. **Bar-thumbnail stall risk** (SwiftShader 1 373,6 ms per edit; the real AMD GPU shows no long task): add a self-timing guard. If `thumbFrame` takes more than 50 ms twice, turn the thumbnail off.
4. **B-WR-07:** "3D drehen" silently refuses below 50 % visibility, so a tap looks broken. Scroll the stage into view first, or announce the reason in `#view-hint`.
5. **A-IN-03:** "ein Drittel" is hard-coded in frame.rim.bevel, view.protrusion and disclaimer.body. Add a test that ties it to `BEVEL_RULES[BEVEL_RULE]`.
6. **No 'Nachher (B):' bar prefix** when the cards show B. Optional and cheap; it fixes the same confusion as M2.
7. **No on-lens callouts in split Dickenkarte; 1 of 6 iso labels on phones:** accepted. The table, `#cmp-diff` and the legend carry the numbers.
8. **Front-surface lead is text-only in Seite:** accepted. For the minus example the rim hides it in a true silhouette. For Sph +6 the front surface clearly sits ahead of the rim (text 4,7 / 4,9 mm). Add a plus-lens Seite e2e as evidence.
9. **Assumed design values:** accepted. Cite a manufacturer size table for 110–160 mm or keep it marked "from memory", and check the unlabelled values (chart 200 mm, earpiece) in Technische Angaben.
10. **Gate drift:** f52ac80 came after the full gate at 7f44aef. CI gates the deploy anyway; record the CI run as the binding gate.
11. **m7 stays deferred** (the Simple page is 8 771 px at 360 px). Set a length target in phase 4.
12. **638 kB view chunk** (168 kB gzip, lazy): accepted.
13. **`without3d` e2e trade-off:** accepted.
14. **Other open Info items** (A-IN-01/02/04/07, B-IN-01…05/07): accepted as recorded. A-IN-07 (VoiceOver table semantics) is UNVERIFIED. A-IN-04 cannot be reached through the UI.

## Rulings on the orchestrator's items 1–8

1. The low-index margin: see M1.
2. The '1:2' bevel change: accepted (source checked, labelled assumed, one helper used everywhere).
3. m6 and m7 stay deferred. Revisit a "very thick" note in phase 4; a 40–58 mm edge is still shown without a warning.
4. The assumed design values: accepted (MINOR 9).
5. A1–A4, B-WR-04, B-WR-07 and `tech.view.reason.error`: accepted, except B-WR-07's silent refusal (MINOR 4).
6. Open UI items: `#view-protrusion` is MAJOR (M2); the rest are MINOR or accepted.
7. B-IN-06 and A-IN-06 are MINOR, not push blockers.
8. Every 3D number comes from the engine, and the UI is de-AT only: **yes**.

## Push with VIZ-06 pending

**Allowed** under these conditions:
- M1 and M2 are fixed or user-accepted.
- VIZ-06 stays Pending and phase 3 stays open until Task 3.
- The pass criteria are written down before measuring:
  - input → 3D paint ≤ 200 ms median at 412 px with the bar thumbnail shown;
  - orbit at about vsync;
  - renderer memory constant over 20+ edits.
- The fallback is decided in advance: the MINOR 3 guard, or thumbnail off on phones.
