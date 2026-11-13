# Phase 4 — lens-critic plan review (round 2)

**Date:** 2026-11-13
**Reviewed:** 04-01-PLAN.md … 04-15-PLAN.md after revision 1 (15 plans, 9 waves)
**Verdict:** FAIL (NEEDS WORK) — 0 BLOCKER, 2 MAJOR, 9 MINOR

M3, M4 and M5 are closed, and so are MINOR 1–10. M1 and M2 are each partly closed: a kill build still cannot pass its own deploy gate, and on phones the only available step-down costs more rays in rim cases, not fewer.

## Status of round-1 findings

| ID | Status | Evidence in the plan text |
|---|---|---|
| M1 kill switch | **partly** | The single flag, the flag-aware build test, the rehearsal, the duration/re-enable text and the sibling check are all there (04-04 T1/T2, 04-14 T3). Open: see NEW-1. |
| M2 phone performance, rim case | **partly** | Rim case in the bench, tier-dependent `leafPx`, CI ray-count gate and bench result in the gate are there (04-03 T1/T3, 04-05 T3, 04-13 T1). Open: see NEW-2. |
| M3 on-screen mirror/swap test | **closed** | 04-08 T1 writes M3 (a), (b), (c) RED; T3 is the hard gate. Simulation: a y-flip with sign flip, or a per-eye x-mirror, inverts the (a) ratio at all 11 panel sizes tried, so it fails. Test-design problems remain: NEW-3. |
| M4 tested = deployed | **closed** | 04-02 T1 adds `parity.test.js` and `env-gates.test.js`; 04-08 T1 adds hook-free `ref-live.spec.js` to `LIVE_SPECS`; 04-06 T2 runs `test:pwa:live` in verify-live. `e2e/helpers.js:237`: `guardPage(test, { view: true })` does skip `without3d`. |
| M5 citation | **closed** | 04-01 T2 source line and 04-08 T2 `tech.ref.formulaSource`. The patent was fetched: it states "e = HSA + 3.05 mm" as the preferred model, to the entrance pupil, in the power term. The wording claims no more than that. |
| MINOR 1 drawn interpolant | closed | `CELL_DIAGONAL`, `gridTriangles`, N10 on triangle centroids with ×30 and ×120 (04-03 T1/T2, 04-08 T1). |
| MINOR 2 E10 at 400 px | closed | `measure-stages.mjs` first, values pinned to measurements, minimum long side recorded (04-03 T3). |
| MINOR 3 `tirBack` | closed | Synthetic n < 1 for the branch; real `tirFront` case pinned (04-01 T1, 04-03 T1). |
| MINOR 4 entrance pupil test | closed | Six-value test, 3,04 ± 0,005 mm (04-01 T2). |
| MINOR 5 `hadController` | closed | Flag flips after the first `controllerchange`; unit case (e) and e2e item 20b (04-07 T2, 04-14 T2). |
| MINOR 6 rollback text | closed | W3C citation and "NO rollback for returning visitors" (04-13 T2). |
| MINOR 7 SC1 asked too late | closed | Orchestrator decision 6; see "The SC1 decision" below. |
| MINOR 8 strings | closed | No "Prozentpunkt"; `rimPastNote` only with class-5 picture on screen (04-01 T3, 04-09 T2). |
| MINOR 9 serial `pwa` project | closed | One spec file, `fullyParallel: false` (04-06 T2). Local stale-state gap: NEW-6. |
| MINOR 10 `nyquist_compliant` | closed | Stays `false` until 04-13 T1. |
| MINOR 11 | deferred | `deferred-items.md`, with evidence lines. Acceptable. |

## New findings

### MAJOR

#### NEW-1 (M1 residue). A kill build still fails its own gate, and the rehearsal does not test the real kill build

- **Where:** 04-06 T2 step 3, 04-14 T1 step 1 and T2/T3, 04-12 T2 step 2, and the vite.config comment in 04-04 T1 step 4.
- **What is wrong:**
  - With `SW_SELF_DESTROY = true`, `update.js` does not register (04-14 T1). Only the two offline tests, the scope assertion and the rehearsal have a skip.
  - These have no skip and need a worker:
    - "registers without input within 5 s (item 18)";
    - "CSP unchanged with the worker active @live";
    - items 19–24 and 20b;
    - the three banner axe states of 04-12.
  - `npm run test:e2e` runs the `pwa` project, so CI fails and nothing deploys. The "@live" CSP test would also fail verify-live.
  - The comment in 04-04 says the "offline/update tests skip"; 04-14 does not specify that.
  - No task ever runs the gate with the flag on. 04-04 step 6 checks only the worker shape.
  - The rehearsal build uses `SW_KILL_REHEARSAL=1`, but `update.js` imports the constant, which is still `false`. The plugin's `register.js` in self-destroying mode still calls `wb.register()`. So the rehearsal build re-registers the destroyer on every load. "getRegistrations() is [] and stays []" is then timing-dependent, and the no-registration branch is never executed by any test.
- **Why it matters:** rollback (b) still needs test edits under pressure, which was the core of M1.
- **Fix:**
  1. Compute one effective flag in `vite.config.js` (`SW_SELF_DESTROY || env`) and inject it with `define`, so `update.js` and the plugin always agree. Export the same expression to the Node tests.
  2. Put a `test.skip(KILL, 'kill switch on')` on item 18, the CSP-with-worker test, and a `describe`-level skip on the update tests.
  3. Add one step to 04-14 T3: build with the effective flag on, then `npm run test:dist` and `npx playwright test --project=pwa` must exit 0. Paste the output.
  4. Say in "kill switch active @live" that a fresh context only proves the `sw.js` shape, not removal for returning visitors.

#### NEW-2 (M2 residue). On phones the step-down increases the work in rim cases

- **Where:** 04-03 T1 (`REF_GRID_TIERS`), T3 acceptance rule and ray-count gate; 04-05 T3; 04-10 T2 step 5.
- **What is wrong:** the quadtree halves the cell, so the real leaf sizes are fein 0,75 px, mittel 2,0 px and grob 1,35 px. Grob refines finer than mittel. Scratch counts for the item-12 frame, −4,00 (+4,00 is within 3 %); the largest spread is with full subdivision of mixed cells, the adaptive variant gives +8 to +35 %:

  | Panel | fein | mittel | grob | grob vs mittel |
  |---|---|---|---|---|
  | 288×216 | 6 549 | 1 900 | 3 148 | +66 % |
  | 581×593 | 22 856 | 8 120 | 10 010 | +23 % |

  - Phones start at mittel (04-10 D-15), so their only step is mittel → grob.
  - The gates check only rays(mittel) < rays(fein) and rays(grob) ≤ 0,5 × rays(fein). Both pass (0,44–0,49).
  - The 04-10 "fewer rays after the step" e2e uses a case with no rim, so it passes too.
- **Why it matters:** rim-case phone users get "Vereinfachte Darstellung" and a slower picture.
- **Fix:**
  1. Add rays(grob) ≤ rays(mittel) ≤ rays(fein) for both item-12 panels to the P0 acceptance rule, the CI ray gate and the bench.
  2. Choose a grob leaf that is not finer than mittel's. `leafPx: 3` gives 2,75 px leaves and 1 228 rays; boundary error 2,75·√2/2 = 1,94 px, inside N10's 2 px. Or use cell sizes that are leaf × 2^k.
  3. Run the 04-10 step-down e2e once with the item-12 frame, starting at mittel.

### MINOR

**NEW-3. The M3 gate can fail on a correct picture, while the plan forbids relaxing it.**
- **(a), 04-08 T1:** corner windows are not on the diagonals in a non-square panel. Simulated correct picture: 86 vs 36 (2,39×) at 189×285, 2,61× at 300×450, 2,50× at 320×400; the other eight sizes pass. The stage size at 1280×800 is not known yet. The 3× came from round 1 and was not computed then. Real texture filtering will lower the ratio further.
  - Fix: use the two lower corner windows of the centred inscribed square (LL vs LR). That gives ≥ 3× at all 13 sizes tried and inverts on a flip. Or keep the corners and require 2×; a flip gives ≤ 0,42×.
- **(b) and (c):** the chart has a square corner at the panel centre, so the "horizontal centre row" and the "vertical centre line" lie exactly on checker edges. Pixels there are blended grey; with an odd panel size the centre row straddles the edge. In (c) the "above" point can also fall in the letter band.
  - Fix: sample half a square off the centre lines and outside the band (+1 to +3 squares). State the viewport for (b), (c) and item 6: the mobile project has one panel.

**NEW-4. N10 at grob has no margin.** −10,00/−4,00×30 at an 11 px cell gives 0,49976 px against the 0,5 px limit (sw-ne split, 199×250). Have P0 pick grob with headroom (≤ 0,45 px).

**NEW-5. Parallel worktrees share fixed ports.** `playwright.config.js:18` has `reuseExistingServer: !process.env.CI`. Waves 2, 4 and 7 now pair plans that each start servers on 4173/4174/4175. One worktree can silently test the other's build. Fix: a per-worktree port offset, or `reuseExistingServer: false` so a clash fails loudly. UNVERIFIED how the orchestrator schedules e2e runs.

**NEW-6. Switch server state survives between local runs.** A run that ends on `/__switch/b` or `/kill` leaves the reused server there, and the top-level offline tests then run on the wrong build. Fix: a file-level `beforeAll` reset to A when not live.

**NEW-7. The 04-11 A/B pixel check does not catch swapped panels.** It only asserts the two uv arrays differ. Fix: A = item-12 frame, B = default frame; rim colour appears only in the left panel.

**NEW-8. Parity test covers only `*worker*.js`.** The sync-fallback chunks (`compute-protocol-*`, `mesh-protocol-*`, later warp) carry the same engine code. Fix: assert that the filename difference between `dist/assets` and `dist-e2e/assets` is a subset of an allow-list (entry, view chunk).

**NEW-9. Strings.**
- `cylSameNote` says the cylinder "verändert die Bildgröße in beiden Richtungen fast gleich stark". The cylinder is what makes the two directions differ. Suggest: "Mit Ihrem Zylinder ist die Bildgröße in beiden Richtungen fast gleich, darum steht hier nur ein Wert."
- `tech.ref.formulaSource` uses "Produktform" unexplained and both "Hornhautscheitelabstand" and "HSA". Suggest "Formel (Formfaktor × Brechwertfaktor)" and one term. Add that 3,05 mm is the patent's preferred model.
- `rimNote` and `rimPastNote` read well.
- 04-08 and 04-09 interface blocks still list `refSizeBlock` without `pastRimInField`.

**NEW-10. SC1 decision has no artefact.** See below.

## The SC1 decision

It is defensible. A project-internal reinterpretation is neither outward-facing nor irreversible, so it falls under the standing preference, and the M3 gate is real. The static picture also carries more than the plan claims: a 1 dpt cylinder moves the picture 3,4 px along the long side and 1,7 px along the short side (reproduced).

It is stated consistently in 04-01 (ground rule 12 (6)), 04-03 (must-have and objective), 04-08 (must-have and hard-gate paragraph) and 04-13 (must-have, decision text, option and acceptance).

Two gaps:
- "Reported to the user before execution" is an orchestrator action with no task and no artefact, yet 04-13 asserts it as fact. Fix: require the report (date and text) in the 04-01 SUMMARY or session log, and add it to the 04-13 T1 guards.
- `04-UI-SPEC.md:817` still says "Open for the user (accept or veto)". Update it in the 04-03 docs commit.

## What was verified

**By running** (scratch scripts `r2-rays.mjs`, `r2-m3.mjs`, `r2-m3b.mjs`, `r2-n10.mjs`, `r2-n10b.mjs`, `e10.mjs`):
- Ray counts per tier, for two quadtree readings, −4,00 and +4,00, two panel sizes.
- Time ratio grob/fein 0,36–0,54 against the 0,6 limit. This is a naive classifier and noisy; treat the 0,6 gate as thin at the small panel.
- M3 (a) counts for OD and OS at 11 panel sizes, correct, y-flipped and x-mirrored.
- M3 (b) edge shifts: 4,4 px (−4,00) and 6,0 px (+4,00) at 246,8 px/tan, against the 2 px threshold.
- Drawn-interpolant error per tier.

**By reading:** all 15 plans, the VALIDATION and RESEARCH diffs, `deferred-items.md`; vite-plugin-pwa 2.0.0 `register.js` and destroyer source; `e2e/helpers.js`, `playwright.config.js`, `package.json`, the current `dist/assets` names; the patent via Google Patents.

**Not verified:**
- Any Playwright, service-worker or kill-switch behaviour by execution (read-only, plugin not installed).
- The real stage size at 1280×800.
- The production classifier's cost.
- That Vite's worker filename hash is purely content-derived.
- Bennett & Rabbetts.
- Whether RESEARCH actually fetched the USPTO PDF; its Sources list gives no fetch status.

## Sources

- [US 8,805,612 B2 on Google Patents](https://patents.google.com/patent/US8805612B2/en)
