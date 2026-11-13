# Phase 4 — lens-critic plan review (round 1)

**Date:** 2026-11-13
**Reviewed:** 04-01-PLAN.md … 04-13-PLAN.md (13 plans, 10 waves), before any revision
**Verdict:** FAIL (NEEDS WORK) — 0 BLOCKER, 5 MAJOR, 11 MINOR

The optics is right and every reference number was reproduced. The MAJORs are in evidence, rollback and phone performance.

## What was checked

- **Baseline:** `npx vitest run --project unit` gives 46 files, 1800 tests passed; `trace.test.js` has 16 tests, as 04-01 states.
- **Reverse trace and magnification oracle:** a scratch copy of `intersect`/`refract` on the engine's own surfaces reproduces every 04-01 reference value to 6 decimals.
  - −4,00 → −0,056037; +4,00 → +0,077669; −2,00/−2,00×30 → −0,028543 at engine 30,00° and −0,056037 at 120,00°, for OD and OS; plano +0,000600; base 6 plano +0,007252; −6,00 in 1,67 −0,082238; −10,00 −0,129913.
  - The closed form and the trace Jacobian agree to the 6 decimals printed.
- **Wearer mirror:** φ = 180° − θ is right for TABO (30° runs from top-left to bottom-right for the wearer).
- **Aperture classes (E9):** the item-12 frame gives boundaries at tan 0,4335 / 0,4740 / 0,7615 for −4,00 and 0,3795 / 0,4670 / 0,7335 for +4,00, mirrored for OS. All plan sample points fall in the stated class.
- **Entrance pupil:** the Le Grand full-eye data, typed from memory, give 3,038 mm.
- **Service-worker claim:** the planner's from-memory claim is correct. W3C Service Workers, Update algorithm: on a failed script fetch, "If newestWorker is null, then remove registration map[…]. Invoke Finish Job". An existing registration is kept, so a revert pins returning visitors to the cached phase-4 build.
- **Plugin tarball (`vite-plugin-pwa@2.0.0`, read in scratch):** `selfDestroying` does `caches.keys()` and deletes every cache on the origin, and navigates controlled windows. `onNeedReload` exists, and `updateSW()` only posts SKIP_WAITING.

## MAJOR

### M1. The kill switch cannot pass its own deploy gate, and is never rehearsed (04-04 T1/T2, 04-06 T2, 04-13 T2)

- Evidence: `test/dist/pwa-build.test.js` requires a precache list, a SKIP_WAITING handler and clientsClaim in `sw.js`; `pwa.spec.js` requires offline to work. With `selfDestroying: true`, `sw.js` is the 20-line destroyer, so `test:dist` and `test:e2e` fail and nothing deploys.
- Why it matters: the stated rollback (b) needs test edits under pressure.
- Fix:
  - Put the flag in one constant that the tests read, and assert the destroyer shape when it is on.
  - Add one switch-server rehearsal: build A, then a kill build, then assert the registration and the `eyeglass-rx-*` caches are gone.
  - Extend the steps: the page re-registers the destroyer on every visit, so "getRegistrations() is []" is racy. Say how long the destroyer stays deployed and how to re-enable.
  - Check whether the four sibling projects use Cache Storage at all, and record it.

### M2. Phone performance evidence skips the expensive case, and degrading does not help there (04-03 T2, 04-05 T3, 04-10)

- Evidence: the tier bench uses only `NORMAL_PAIR` and `GRENZFALL_PAIR` in the 412 px layout; neither has a rim in the field. Leaves are always ≤ 1 px, whatever the tier.
- Scratch measurement (naive classifier, i7-8809G, so an upper bound):

  | Case | Rays | Time |
  |---|---|---|
  | Default frame, 189×285, fein | 1 617 | — (trace alone is 0,84 µs/ray) |
  | Item-12 frame, 288×216, fein | 11 213 | 128 ms |
  | Item-12 frame, 288×216, grob | 11 508 | 130 ms |
  | Item-12 frame, 581×593 panel | about 35 000 | 390–450 ms |

- Why it matters: the UI-SPEC's own sample found an edge band in 20 970 of 80 572 accepted G2 cases. Those users would get the "Vereinfachte Darstellung" note with no speed-up.
- Fix:
  - Add the item-12 frame (320 px one-panel and one large panel) to the bench and to the P0 timing table.
  - Make `leafPx` tier-dependent (N10 allows 2 px).
  - Add a host-independent CI gate on ray count per tier.
  - Put the `BENCH_GATE=1` result into the 04-13 acceptance criteria.

### M3. No on-screen test would catch a mirrored cylinder or swapped eyes (04-08 T1/T3, 04-09 T2)

- Evidence: the D-07 golden test stops at the warp array. In e2e, item 4 is text only, item 25 uses axes 180 and 90, item 12 samples the horizontal centre line of a y-symmetric frame, and item 6 checks the pill only.
- Why it matters: a y-flip of grid positions combined with a sign flip of v leaves spheres, ticks, the letter band and items 1–27 green, but draws 30° where 150° belongs.
- Fix, one pixel test in `view-ref.spec.js`:
  - 0,00/−4,00×45: the Mit/Ohne changed-pixel count in the corner on the screen 45° diagonal is at least 3× the count on the 135° diagonal.
  - OD −4,00 / OS +4,00, two panels: edge squares move inward in the right panel and outward in the left.
  - One y-asymmetric rim case (`pilot`).

### M4. "Tested artifact = deployed artifact except the gated hook" is not enforced (04-02 T1)

- Evidence: `hooks.test.js` only checks that two strings are absent or present. All eight `LIVE_SPECS` call `guardPage(test)`, which sets `window.__eyeglassNo3d` (`src/ui/pipeline.js:230`). So the subset is not hook-free, and it never loads the 3D chunk or the Durchblick on `dist` or the live site. `live-subset.test.js` greps only `__eyeglassView` and `backgroundProbe(`. `verify-live` never checks the service worker.
- Fix:
  - Parity test in `test/dist`: the worker bundle filenames (content-hashed) are identical in `dist` and `dist-e2e`, and `import.meta.env` appears in `src/` only at an allow-list.
  - Add one hook-free Durchblick smoke to `LIVE_SPECS` (mode switch, `#view[data-pending]=''`, badge, one size line).
  - Run the `pwa` scope test in `verify-live`.

### M5. The mandated citation contradicts the value used (04-01 T2, 04-08 `tech.ref.*`)

- Evidence: the acceptance criteria lock in "corroborated by" two URLs. Both were fetched. open-exam-prep defines d as the vertex distance (worked example: +8,00 at 12 mm → 1,106). opticiansfriend does not define the distance.
- Why it matters: with d = 12 mm, −4,00 gives −4,5 % ("5 %"), not "6 %". The entrance-pupil choice is physically right, but nothing cited supports it.
- Fix: reword to "product form: these sources; they use the vertex distance; the entrance-pupil reference is from the derivation and US 8,805,612 B2 (HSA + 3,05 mm); textbook page open". Say the same in `tech.ref.formula`.

## MINOR

1. **Interpolation test (04-03 T2/T3):** N10 tests bilinear interpolation, but the GPU draws triangles. For −10/−4×30 at an 11 px cell: 0,303 px bilinear and 0,500 px on one diagonal. P0's "largest passing size" would overshoot; test the drawn interpolant.
2. **E10 at 400 px (04-03 T2):** the true value is 3,003 px, and 2,9 is fitted, not derived. A 248 px-high stage gives 2,98 px with no weak note. Pin the measured value, record the minimum long side (about 250 px), and measure the real stage sizes first.
3. **`tirBack` (04-01 T1):** unreachable for n > 1 (swept tan 0…40 at 1,74). Say it needs a synthetic n < 1. Pin a real class-3 case: −4,00 CR-39, OD temporal tan 1,97 gives `tirFront` with the back hit inside.
4. **Entrance pupil (04-01 T2):** add a six-number unit test that reproduces 3,04 mm from the cited table.
5. **`hadController` (04-07 T2):** a first-visit tab is never reloaded when another tab updates, so its lazy warp worker would 404. Set the flag after the first `controllerchange` instead of only at module start.
6. **Rollback text (04-13 T2):** replace "unverified" with the spec citation, and say plainly that option (1) is no rollback for returning visitors.
7. **ROADMAP criterion 1 (04-13 T2):** the reinterpretation is asked for only at wave 10. Put it to the user now; a late veto costs the whole view. On the merits it is acceptable once M3 is fixed.
8. **New strings (04-01 T3):** "Prozentpunkt" in `view.ref.cylSameNote` is jargon. `view.ref.rimNote` says "dahinter sehen Sie am Glas vorbei" even where nothing beyond the rim is on screen.
9. **`pwa` project (04-07 T3):** the switch server has global A/B state. Set serial mode or one worker explicitly.
10. **`04-VALIDATION.md`:** `nyquist_compliant: true` is already set, while 04-13 says to set it only when every row is green.
11. **Test switches (out of scope):** seven older query switches still ship in production (`thumbguardoff`, `failframe`, `nowebgl`, `cmpdelay`, `msgprobe`, `calloutsoff`, `perfmarks`). 04-02 creates the gate that could cover them.

## Deviations accepted

- The fixed `LIVE_SPECS` list, once M4 is fixed.
- `test:coverage --project unit`, ports 4173/4174/4175, and the bench in `test/bench`.
- The 1,3 % weak-note threshold.
- Keeping the D-21 input handover.
- `clientsClaim: true`, with MINOR 5.
- Both open human items; they are correctly not claimed.

## Not verified

- workbox-build 7.4.1 internals (the cleanup scope filter is from memory).
- Bennett & Rabbetts.
- Real stage sizes and real-phone timings.
- The production classifier's cost; the M2 numbers come from a naive scratch version.

## Sources

- [W3C Service Workers, Update algorithm](https://w3c.github.io/ServiceWorker/)
- [open-exam-prep: Lens Thickness, Magnification & Effective Power](https://open-exam-prep.com/study-guides/abo-advanced/optics-ii/thickness-magnification-effective-power)
- [opticiansfriend: Optics Study Guide](https://www.opticiansfriend.com/equations/)
- [20/20 Magazine: Design of Iseikonic Lenses, Part Two](https://2020mag.com/article/design-of-iseikonic-lenses-part-two)
- [vite-plugin-pwa 2.0.0 tarball](https://registry.npmjs.org/vite-plugin-pwa/-/vite-plugin-pwa-2.0.0.tgz)
